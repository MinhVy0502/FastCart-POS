const { Op } = require('sequelize');
const { Sale, SaleItem, Product, InventoryTransaction, Customer, User, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, dateRange, generateCode, toNumber } = require('../utils/query');

const PAYMENT_METHODS = ['CASH', 'TRANSFER'];

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
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
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
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'address'] },
        { model: User, as: 'user', attributes: ['name'] },
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }]
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
      customer = await Customer.findOne({ where: { id: customerId, userId: req.user.id }, transaction });
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
    const customerPaid = paymentMethod === 'CASH'
      ? Math.max(toNumber(req.body.customerPaid, finalAmount), 0)
      : finalAmount;
    if (paymentMethod === 'CASH' && customerPaid < finalAmount) {
      throw new AppError('Tiền khách đưa chưa đủ');
    }

    const code = generateCode('HD');
    const sale = await Sale.create({
      code, customerId: customer ? customer.id : null, note, totalAmount, discount, finalAmount,
      customerPaid, paymentMethod, status: 'COMPLETED', userId: req.user.id
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
      await customer.update({ totalSpent: toNumber(customer.totalSpent) + finalAmount }, { transaction });
    }

    await transaction.commit();
    res.status(201).json({ success: true, message: 'Tạo hóa đơn thành công', data: sale });
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
        await customer.update({ totalSpent: newTotal }, { transaction });
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
