const { Op } = require('sequelize');
const { Purchase, PurchaseItem, Product, InventoryTransaction, Supplier, User, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, dateRange, generateCode, toNumber } = require('../utils/query');

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 20);
    const { search, from, to, supplierId } = req.query;

    const where = { userId: req.user.id };
    const created = dateRange(from, to);
    if (created) where.createdAt = created;
    if (supplierId) where.supplierId = supplierId;
    if (search) {
      where[Op.or] = [
        { code: { [Op.iLike]: `%${search}%` } },
        { '$supplier.name$': { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Purchase.findAndCountAll({
      where,
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
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
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone', 'address'] },
        { model: User, as: 'user', attributes: ['name'] },
        {
          model: PurchaseItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku'] }]
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
    // Mặc định cập nhật giá nhập của sản phẩm theo giá mới nhất
    const updateImportPrice = req.body.updateImportPrice !== false;

    if (!Array.isArray(items) || items.length === 0) throw new AppError('Phải có ít nhất 1 sản phẩm');

    if (supplierId) {
      const supplier = await Supplier.findOne({ where: { id: supplierId, userId: req.user.id }, transaction });
      if (!supplier) throw new AppError('Nhà cung cấp không tồn tại');
    }

    const lines = [];
    let totalAmount = 0;
    for (const item of items) {
      const quantity = parseInt(item.quantity);
      const price = toNumber(item.price, -1);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new AppError('Số lượng phải là số nguyên dương');
      if (price < 0) throw new AppError('Giá nhập không hợp lệ');

      const product = await Product.findOne({
        where: { id: item.productId, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!product) throw new AppError('Sản phẩm không tồn tại');
      totalAmount += quantity * price;
      lines.push({ product, quantity, price });
    }

    const code = generateCode('PN');
    const purchase = await Purchase.create({
      code, supplierId: supplierId || null, note, totalAmount, userId: req.user.id
    }, { transaction });

    for (const { product, quantity, price } of lines) {
      await PurchaseItem.create({
        purchaseId: purchase.id,
        productId: product.id,
        quantity,
        price
      }, { transaction });

      const updates = { currentStock: product.currentStock + quantity };
      if (updateImportPrice && price > 0) updates.importPrice = price;
      await product.update(updates, { transaction });

      await InventoryTransaction.create({
        productId: product.id,
        type: 'IN',
        quantity,
        referenceCode: code,
        note: `Nhập hàng phiếu ${code}`
      }, { transaction });
    }

    await transaction.commit();
    res.status(201).json({ success: true, message: 'Nhập hàng thành công', data: purchase });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
