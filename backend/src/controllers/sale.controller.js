const { Op } = require('sequelize');
const { Sale, SaleItem, Product, InventoryTransaction, Customer, User, DebtHistory, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, dateRange, generateCode, toNumber } = require('../utils/query');

const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'DEBT'];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 20);
    const { search, from, to, status } = req.query;

    const where = { userId: req.user.id };
    const created = dateRange(from, to);
    if (created) where.createdAt = created;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { '$customer.name$': { [Op.iLike]: `%${search}%` } },
        { '$customer.phone$': { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'storeName', 'customerType'] },
        { model: User, as: 'user', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      subQuery: false
    });

    res.json({ success: true, data: rows, pagination: buildPagination(count, page, limit) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'address', 'storeName', 'customerType', 'currentDebt', 'debtLimit'] },
        { model: User, as: 'user', attributes: ['name'] },
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'wholesalePrice', 'salePrice'] }]
        }
      ]
    });
    if (!sale) return res.status(404).json({ success: false, message: 'Không tìm thấy hóa đơn' });
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { customerId, note, items } = req.body;
    const discount = toNumber(req.body.discount);
    const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'CASH';

    if (!Array.isArray(items) || items.length === 0) throw new AppError('Phải có ít nhất 1 sản phẩm');
    if (discount < 0) throw new AppError('Giảm giá không hợp lệ');

    // Khách hàng phải thuộc cửa hàng hiện tại
    let customer = null;
    if (customerId) {
      customer = await Customer.findOne({
        where: { id: customerId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!customer) throw new AppError('Khách hàng không tồn tại');
    }

    // Kiểm tra & khóa sản phẩm trước khi tạo hóa đơn
    const lines = [];
    let totalAmount = 0;
    for (const item of items) {
      const quantity = parseInt(item.quantity);
      const price = toNumber(item.price, -1);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError('Số lượng phải là số nguyên dương');
      if (price < 0) throw new AppError('Đơn giá không hợp lệ');

      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) throw new AppError('Sản phẩm không tồn tại');
      if (product.currentStock < quantity) {
        throw new AppError(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.currentStock})`);
      }
      totalAmount += quantity * price;
      lines.push({ product, quantity, price });
    }

    if (discount > totalAmount) throw new AppError('Giảm giá không được lớn hơn tổng tiền');
    const finalAmount = totalAmount - discount;

    let customerPaid = 0;
    if (paymentMethod === 'DEBT') {
      customerPaid = Math.max(toNumber(req.body.customerPaid, 0), 0);
      if (!customer) {
        throw new AppError('Chỉ khách hàng/đại lý có trong danh bạ mới được mua nợ. Vui lòng chọn khách hàng!');
      }
    } else {
      customerPaid = req.body.customerPaid !== undefined
        ? Math.max(toNumber(req.body.customerPaid), 0)
        : finalAmount;
      if (customerPaid < finalAmount && !customer) {
        throw new AppError('Khách lẻ phải thanh toán đủ tiền');
      }
    }

    const unpaidAmount = Math.max(0, finalAmount - customerPaid);

    let debtWarning = null;
    if (unpaidAmount > 0 && customer) {
      const currentDebt = toNumber(customer.currentDebt);
      const debtLimit = toNumber(customer.debtLimit);
      const balanceAfter = currentDebt + unpaidAmount;
      if (debtLimit > 0 && balanceAfter > debtLimit) {
        debtWarning = {
          exceeded: true,
          currentDebt,
          debtLimit,
          balanceAfter,
          overAmount: balanceAfter - debtLimit
        };
      }
    }

    const code = generateCode('HD');
    const sale = await Sale.create({
      code,
      customerId: customer ? customer.id : null,
      note,
      totalAmount,
      discount,
      finalAmount,
      customerPaid,
      paymentMethod,
      status: 'COMPLETED',
      userId: req.user.id
    }, { transaction });

    for (const { product, quantity, price } of lines) {
      await SaleItem.create({
        saleId: sale.id,
        productId: product.id,
        quantity,
        price,
        costPrice: product.importPrice
      }, { transaction });

      await product.update({ currentStock: product.currentStock - quantity }, { transaction });

      await InventoryTransaction.create({
        productId: product.id,
        type: 'OUT',
        quantity,
        referenceCode: code,
        note: `Bán hàng hóa đơn ${code}`
      }, { transaction });
    }

    if (customer) {
      const currentDebt = toNumber(customer.currentDebt);
      const newTotalSpent = toNumber(customer.totalSpent) + finalAmount;

      if (unpaidAmount > 0) {
        const balanceAfter = currentDebt + unpaidAmount;
        await DebtHistory.create({
          customerId: customer.id,
          userId: req.user.id,
          type: 'INCREASE',
          amount: unpaidAmount,
          balanceBefore: currentDebt,
          balanceAfter,
          referenceCode: code,
          paymentMethod,
          note: `Mua nợ từ đơn hàng ${code}${customerPaid > 0 ? ` (Đã trả trước ${customerPaid.toLocaleString('vi-VN')}đ)` : ''}`
        }, { transaction });

        await customer.update({
          totalSpent: newTotalSpent,
          currentDebt: balanceAfter
        }, { transaction });
      } else {
        await customer.update({
          totalSpent: newTotalSpent
        }, { transaction });
      }
    }

    await transaction.commit();
    res.status(201).json({
      success: true,
      message: debtWarning ? 'Tạo hóa đơn thành công (Lưu ý: công nợ vượt hạn mức)' : 'Tạo hóa đơn thành công',
      data: sale,
      debtWarning
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/** Hủy hóa đơn: hoàn tồn kho, trừ tổng chi tiêu của khách. */
exports.cancel = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const sale = await Sale.findOne({
      where: { id: req.params.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!sale) throw new AppError('Không tìm thấy hóa đơn', 404);
    if (sale.status === 'CANCELLED') throw new AppError('Hóa đơn này đã bị hủy trước đó');

    const reason = (req.body.reason || '').trim();
    const items = await SaleItem.findAll({ where: { saleId: sale.id }, transaction });

    for (const item of items) {
      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) continue;
      await product.update({ currentStock: product.currentStock + item.quantity }, { transaction });
      await InventoryTransaction.create({
        productId: product.id,
        type: 'IN',
        quantity: item.quantity,
        referenceCode: sale.code,
        note: `Hoàn kho do hủy hóa đơn ${sale.code}${reason ? ` – ${reason}` : ''}`
      }, { transaction });
    }

    if (sale.customerId) {
      const customer = await Customer.findOne({ where: { id: sale.customerId, userId: req.user.id }, transaction });
      if (customer) {
        const newTotal = Math.max(toNumber(customer.totalSpent) - toNumber(sale.finalAmount), 0);
        const unpaidForThisSale = Math.max(0, toNumber(sale.finalAmount) - toNumber(sale.customerPaid));

        if (unpaidForThisSale > 0) {
          const currentDebt = toNumber(customer.currentDebt);
          const newDebt = Math.max(0, currentDebt - unpaidForThisSale);
          await DebtHistory.create({
            customerId: customer.id,
            userId: req.user.id,
            type: 'DECREASE',
            amount: unpaidForThisSale,
            balanceBefore: currentDebt,
            balanceAfter: newDebt,
            referenceCode: sale.code,
            note: `Giảm nợ do hủy hóa đơn ${sale.code}${reason ? ` – ${reason}` : ''}`
          }, { transaction });
          await customer.update({ totalSpent: newTotal, currentDebt: newDebt }, { transaction });
        } else {
          await customer.update({ totalSpent: newTotal }, { transaction });
        }
      }
    }

    const note = reason ? `${sale.note ? sale.note + '\n' : ''}[Đã hủy] ${reason}` : sale.note;
    await sale.update({ status: 'CANCELLED', note }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Đã hủy hóa đơn và hoàn lại tồn kho', data: sale });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
