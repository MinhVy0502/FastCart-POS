const { Op } = require('sequelize');
const { Purchase, PurchaseItem, Product, InventoryTransaction, ProductBatch, Supplier, User, DebtHistory, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, dateRange, generateCode, toNumber } = require('../utils/query');

const PAYMENT_METHODS = ['CASH', 'TRANSFER', 'DEBT'];

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 20);
    const { search, from, to, supplierId, status } = req.query;

    const where = { userId: req.user.id };
    const created = dateRange(from, to);
    if (created) where.createdAt = created;
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { '$supplier.name$': { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Purchase.findAndCountAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone', 'currentDebt'] },
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
    const purchase = await Purchase.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone', 'address', 'currentDebt'] },
        { model: User, as: 'user', attributes: ['name'] },
        {
          model: PurchaseItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'barcode', 'unit'] }]
        }
      ]
    });
    if (!purchase) return res.status(404).json({ success: false, message: 'Không tìm thấy phiếu nhập' });
    res.json({ success: true, data: purchase });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { supplierId, note, items } = req.body;
    const updateImportPrice = req.body.updateImportPrice !== false;
    const paymentMethod = PAYMENT_METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'CASH';

    if (!Array.isArray(items) || items.length === 0) throw new AppError('Phải có ít nhất 1 sản phẩm');

    let supplier = null;
    if (supplierId) {
      supplier = await Supplier.findOne({
        where: { id: supplierId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!supplier) throw new AppError('Nhà cung cấp không tồn tại');
    }

    const lines = [];
    let totalAmount = 0;
    for (const item of items) {
      const quantity = parseInt(item.quantity);
      const rawPrice = item.price !== undefined ? item.price : item.costPrice;
      const price = toNumber(rawPrice, -1);
      const factor = Math.max(parseInt(item.conversionFactor) || 1, 1);
      const unitName = String(item.unitName || item.unit || '').trim();

      if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError('Số lượng phải là số nguyên dương');
      if (price < 0) throw new AppError('Giá nhập không hợp lệ');

      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) throw new AppError('Sản phẩm không tồn tại');

      const baseQty = quantity * factor;
      totalAmount += quantity * price;

      lines.push({
        product,
        quantity,
        price,
        factor,
        unitName: unitName || product.unit || 'Cái',
        baseQty,
        batchNumber: item.batchNumber ? String(item.batchNumber).trim() : null,
        expiryDate: item.expiryDate || null,
        manufacturingDate: item.manufacturingDate || null
      });
    }

    let paidAmount = totalAmount;
    if (paymentMethod === 'DEBT') {
      paidAmount = Math.min(Math.max(toNumber(req.body.paidAmount, 0), 0), totalAmount);
      if (!supplier) {
        throw new AppError('Vui lòng chọn nhà cung cấp để ghi nợ phiếu nhập hàng!');
      }
    } else if (req.body.paidAmount !== undefined) {
      paidAmount = Math.min(Math.max(toNumber(req.body.paidAmount, totalAmount), 0), totalAmount);
      if (paidAmount < totalAmount && !supplier) {
        throw new AppError('Vui lòng chọn nhà cung cấp nếu chưa thanh toán đủ tiền hàng!');
      }
    }

    const unpaidAmount = Math.max(0, totalAmount - paidAmount);

    const code = generateCode('PN');
    const purchase = await Purchase.create({
      code,
      supplierId: supplier ? supplier.id : null,
      note,
      totalAmount,
      paidAmount,
      paymentMethod,
      status: 'COMPLETED',
      userId: req.user.id
    }, { transaction });

    for (const line of lines) {
      const { product, quantity, price, factor, unitName, baseQty, batchNumber, expiryDate, manufacturingDate } = line;

      // Xử lý tạo lô hàng nếu có số lô và hạn sử dụng
      if (batchNumber && expiryDate) {
        await ProductBatch.create({
          productId: product.id,
          userId: req.user.id,
          batchNumber,
          expiryDate: new Date(expiryDate),
          manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
          initialQuantity: baseQty,
          currentQuantity: baseQty,
          note: `Nhập hàng theo phiếu ${code}`
        }, { transaction });
      }

      await PurchaseItem.create({
        purchaseId: purchase.id,
        productId: product.id,
        quantity,
        price,
        unitName,
        conversionFactor: factor,
        batchNumber,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null
      }, { transaction });

      const updates = { currentStock: product.currentStock + baseQty };
      if (batchNumber && expiryDate) updates.hasExpiryDate = true;
      if (updateImportPrice && price > 0) {
        // Giá vốn cơ sở = giá nhập chia cho tỷ lệ quy đổi
        updates.importPrice = Math.round((price / factor) * 100) / 100;
      }
      await product.update(updates, { transaction });

      await InventoryTransaction.create({
        productId: product.id,
        type: 'IN',
        quantity: baseQty,
        referenceCode: code,
        note: `Nhập hàng phiếu ${code} (${quantity} ${unitName})`
      }, { transaction });
    }

    if (supplier && unpaidAmount > 0) {
      const currentDebt = toNumber(supplier.currentDebt);
      const balanceAfter = currentDebt + unpaidAmount;
      await DebtHistory.create({
        supplierId: supplier.id,
        userId: req.user.id,
        type: 'INCREASE',
        amount: unpaidAmount,
        balanceBefore: currentDebt,
        balanceAfter,
        referenceCode: code,
        paymentMethod,
        note: `Ghi nợ nhập hàng phiếu ${code}`
      }, { transaction });

      await supplier.update({ currentDebt: balanceAfter }, { transaction });
    }

    await transaction.commit();
    res.status(201).json({ success: true, message: 'Nhập hàng thành công', data: purchase });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/** Hủy phiếu nhập hàng: trừ ngược lại tồn kho và giảm công nợ NCC (nếu có) */
exports.cancel = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { reason } = req.body;
    const purchase = await Purchase.findOne({
      where: { id: req.params.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!purchase) throw new AppError('Không tìm thấy phiếu nhập', 404);
    if (purchase.status === 'CANCELLED') throw new AppError('Phiếu nhập này đã bị hủy trước đó');

    const reasonClean = (reason || '').trim();
    const items = await PurchaseItem.findAll({ where: { purchaseId: purchase.id }, transaction });

    for (const item of items) {
      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) continue;

      const baseQty = item.quantity * (item.conversionFactor || 1);
      if (product.currentStock < baseQty) {
        throw new AppError(
          `Không thể hủy phiếu nhập vì sản phẩm "${product.name}" đã xuất bán (tồn hiện tại: ${product.currentStock}, cần thu hồi: ${baseQty} ${product.unit || 'Cái'})`
        );
      }

      await product.update({ currentStock: product.currentStock - baseQty }, { transaction });

      // Nếu dòng nhập có tạo lô hàng, trừ lại số lượng trong lô tương ứng
      if (item.batchNumber) {
        const batch = await ProductBatch.findOne({
          where: {
            productId: product.id,
            userId: req.user.id,
            batchNumber: item.batchNumber
          },
          order: [['createdAt', 'DESC']],
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        if (batch) {
          await batch.update({ currentQuantity: Math.max(0, batch.currentQuantity - baseQty) }, { transaction });
        }
      }

      await InventoryTransaction.create({
        productId: product.id,
        type: 'OUT',
        quantity: baseQty,
        referenceCode: purchase.code,
        note: `Thu hồi kho do hủy phiếu nhập ${purchase.code}${reasonClean ? ` – ${reasonClean}` : ''}`
      }, { transaction });
    }

    if (purchase.supplierId) {
      const supplier = await Supplier.findOne({
        where: { id: purchase.supplierId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (supplier) {
        const paid = purchase.paidAmount !== undefined && purchase.paidAmount !== null
          ? toNumber(purchase.paidAmount)
          : toNumber(purchase.totalAmount);
        const unpaidForPurchase = Math.max(0, toNumber(purchase.totalAmount) - paid);
        if (unpaidForPurchase > 0) {
          const currentDebt = toNumber(supplier.currentDebt);
          const newDebt = Math.max(0, currentDebt - unpaidForPurchase);
          await DebtHistory.create({
            supplierId: supplier.id,
            userId: req.user.id,
            type: 'DECREASE',
            amount: unpaidForPurchase,
            balanceBefore: currentDebt,
            balanceAfter: newDebt,
            referenceCode: purchase.code,
            note: `Giảm nợ NCC do hủy phiếu nhập ${purchase.code}${reasonClean ? ` – ${reasonClean}` : ''}`
          }, { transaction });
          await supplier.update({ currentDebt: newDebt }, { transaction });
        }
      }
    }

    const note = reasonClean ? `${purchase.note ? purchase.note + '\n' : ''}[Đã hủy] ${reasonClean}` : purchase.note;
    await purchase.update({ status: 'CANCELLED', note }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Đã hủy phiếu nhập và hoàn ngược tồn kho', data: purchase });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
