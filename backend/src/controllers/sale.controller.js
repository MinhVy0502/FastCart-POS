const { Op } = require('sequelize');
const { Sale, SaleItem, Product, InventoryTransaction, ProductBatch, Customer, User, DebtHistory, sequelize } = require('../models');
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
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'barcode', 'unit', 'wholesalePrice', 'salePrice'] },
            { model: ProductBatch, as: 'batch', attributes: ['id', 'batchNumber', 'expiryDate'] }
          ]
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
      const rawPrice = item.price !== undefined ? item.price : item.unitPrice;
      const price = toNumber(rawPrice, -1);
      const factor = Math.max(parseInt(item.conversionFactor) || 1, 1);
      const unitName = String(item.unitName || item.unit || '').trim();

      if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError('Số lượng phải là số nguyên dương');
      if (price < 0) throw new AppError('Đơn giá không hợp lệ');

      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) throw new AppError('Sản phẩm không tồn tại');

      const baseQtyNeeded = quantity * factor;
      if (product.currentStock < baseQtyNeeded) {
        throw new AppError(`Sản phẩm "${product.name}" không đủ tồn kho (còn ${product.currentStock} ${product.unit || 'Cái'}, cần ${baseQtyNeeded} ${product.unit || 'Cái'})`);
      }
      totalAmount += quantity * price;
      lines.push({
        product,
        quantity,
        price,
        factor,
        unitName: unitName || product.unit || 'Cái',
        batchId: item.batchId || null,
        baseQtyNeeded
      });
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

    for (const line of lines) {
      const { product, quantity, price, factor, unitName, baseQtyNeeded } = line;

      // Xử lý trừ lô theo FEFO (First Expired First Out) nếu sản phẩm có theo dõi HSD
      let assignedBatchId = line.batchId;
      if (assignedBatchId) {
        const batch = await ProductBatch.findOne({
          where: { id: assignedBatchId, productId: product.id },
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (batch) {
          await batch.update({ currentQuantity: Math.max(batch.currentQuantity - baseQtyNeeded, 0) }, { transaction });
        }
      } else if (product.hasExpiryDate) {
        // Tự động tìm lô cận date nhất còn hàng (FEFO)
        const batches = await ProductBatch.findAll({
          where: { productId: product.id, currentQuantity: { [Op.gt]: 0 } },
          order: [['expiryDate', 'ASC']],
          transaction,
          lock: transaction.LOCK.UPDATE
        });

        let remainingToDeduct = baseQtyNeeded;
        for (const b of batches) {
          if (remainingToDeduct <= 0) break;
          const deductFromThis = Math.min(b.currentQuantity, remainingToDeduct);
          await b.update({ currentQuantity: b.currentQuantity - deductFromThis }, { transaction });
          remainingToDeduct -= deductFromThis;
          if (!assignedBatchId) assignedBatchId = b.id;
        }
      }

      await SaleItem.create({
        saleId: sale.id,
        productId: product.id,
        quantity,
        price,
        costPrice: Number(product.importPrice) * factor,
        unitName,
        conversionFactor: factor,
        batchId: assignedBatchId || null
      }, { transaction });

      await product.update({ currentStock: product.currentStock - baseQtyNeeded }, { transaction });

      await InventoryTransaction.create({
        productId: product.id,
        type: 'OUT',
        quantity: baseQtyNeeded,
        referenceCode: code,
        note: `Bán hàng hóa đơn ${code} (${quantity} ${unitName})`
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
          note: `Mua nợ đơn hàng ${code}`
        }, { transaction });

        await customer.update({ currentDebt: balanceAfter, totalSpent: newTotalSpent }, { transaction });
      } else {
        await customer.update({ totalSpent: newTotalSpent }, { transaction });
      }
    }

    await transaction.commit();

    // Lấy lại đơn hàng đầy đủ để in hóa đơn
    const createdSale = await Sale.findByPk(sale.id, {
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'address', 'storeName', 'customerType', 'currentDebt', 'debtLimit'] },
        { model: User, as: 'user', attributes: ['name'] },
        {
          model: SaleItem,
          as: 'items',
          include: [
            { model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'barcode', 'unit', 'wholesalePrice', 'salePrice'] },
            { model: ProductBatch, as: 'batch', attributes: ['id', 'batchNumber', 'expiryDate'] }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Tạo hóa đơn thành công',
      data: createdSale,
      debtWarning
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.cancel = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { reason } = req.body;
    const sale = await Sale.findOne({
      where: { id: req.params.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!sale) throw new AppError('Không tìm thấy hóa đơn', 404);
    if (sale.status === 'CANCELLED') throw new AppError('Hóa đơn này đã bị hủy trước đó');

    const reasonClean = (reason || '').trim();
    const items = await SaleItem.findAll({ where: { saleId: sale.id }, transaction });

    for (const item of items) {
      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) continue;

      const returnedBaseQty = item.quantity * (item.conversionFactor || 1);
      await product.update({ currentStock: product.currentStock + returnedBaseQty }, { transaction });

      // Nếu có liên kết lô hàng, hoàn lại số lượng vào lô đó (và phân bổ sang lô tiếp theo nếu vượt initialQuantity)
      if (item.batchId) {
        let remainingToRestore = returnedBaseQty;
        const batch = await ProductBatch.findOne({ where: { id: item.batchId }, transaction, lock: transaction.LOCK.UPDATE });
        if (batch) {
          const maxCanAdd = batch.initialQuantity > 0
            ? Math.max(batch.initialQuantity - batch.currentQuantity, 0)
            : remainingToRestore;
          const addNow = Math.min(remainingToRestore, maxCanAdd || remainingToRestore);
          await batch.update({ currentQuantity: batch.currentQuantity + addNow }, { transaction });
          remainingToRestore -= addNow;
        }
        if (remainingToRestore > 0) {
          const otherBatches = await ProductBatch.findAll({
            where: { productId: product.id, id: { [Op.ne]: item.batchId } },
            order: [['expiryDate', 'ASC']],
            transaction,
            lock: transaction.LOCK.UPDATE
          });
          for (const ob of otherBatches) {
            if (remainingToRestore <= 0) break;
            const room = ob.initialQuantity > 0 ? Math.max(ob.initialQuantity - ob.currentQuantity, 0) : remainingToRestore;
            if (room <= 0) continue;
            const add = Math.min(remainingToRestore, room);
            await ob.update({ currentQuantity: ob.currentQuantity + add }, { transaction });
            remainingToRestore -= add;
          }
          if (remainingToRestore > 0 && batch) {
            await batch.update({ currentQuantity: batch.currentQuantity + remainingToRestore }, { transaction });
          }
        }
      }

      await InventoryTransaction.create({
        productId: product.id,
        type: 'IN',
        quantity: returnedBaseQty,
        referenceCode: sale.code,
        note: `Hoàn kho do hủy hóa đơn ${sale.code}${reasonClean ? ` – ${reasonClean}` : ''}`
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
            note: `Giảm nợ do hủy hóa đơn ${sale.code}${reasonClean ? ` – ${reasonClean}` : ''}`
          }, { transaction });
          await customer.update({ totalSpent: newTotal, currentDebt: newDebt }, { transaction });
        } else {
          await customer.update({ totalSpent: newTotal }, { transaction });
        }
      }
    }

    const note = reasonClean ? `${sale.note ? sale.note + '\n' : ''}[Đã hủy] ${reasonClean}` : sale.note;
    await sale.update({ status: 'CANCELLED', note }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Đã hủy hóa đơn và hoàn lại tồn kho', data: sale });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
