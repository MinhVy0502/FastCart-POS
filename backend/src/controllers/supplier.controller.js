const { Op } = require('sequelize');
const { Supplier, Purchase, DebtHistory, User, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, toNumber } = require('../utils/query');

const pickFields = (body) => ({
  name: (body.name || '').trim(),
  phone: (body.phone || '').trim() || null,
  email: (body.email || '').trim() || null,
  address: (body.address || '').trim() || null
});

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 500, 1000);
    const { search, hasDebt } = req.query;
    const where = { userId: req.user.id };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (hasDebt === 'true') {
      where.currentDebt = { [Op.gt]: 0 };
    }
    const { count, rows } = await Supplier.findAndCountAll({
      where,
      attributes: {
        include: [
          [sequelize.literal(`(SELECT COUNT(*) FROM "Purchases" p WHERE p."supplierId" = "Supplier"."id" AND COALESCE(p."status", 'COMPLETED') = 'COMPLETED')`), 'purchaseCount'],
          [sequelize.literal(`(SELECT COALESCE(SUM(p."totalAmount"), 0) FROM "Purchases" p WHERE p."supplierId" = "Supplier"."id" AND COALESCE(p."status", 'COMPLETED') = 'COMPLETED')`), 'totalPurchased']
        ]
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
    res.json({ success: true, data: rows, pagination: buildPagination(count, page, limit) });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!supplier) throw new AppError('Không tìm thấy nhà cung cấp', 404);
    const purchases = await Purchase.findAll({
      where: { supplierId: supplier.id, userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const debts = await DebtHistory.findAll({
      where: { supplierId: supplier.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const totalPurchased = purchases
      .filter(p => (p.status || 'COMPLETED') === 'COMPLETED')
      .reduce((sum, p) => sum + toNumber(p.totalAmount), 0);

    res.json({ success: true, data: { ...supplier.toJSON(), totalPurchased, purchases, debts } });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = pickFields(req.body);
    if (!data.name) throw new AppError('Tên nhà cung cấp là bắt buộc');
    const supplier = await Supplier.create({ ...data, userId: req.user.id });
    res.status(201).json({ success: true, message: 'Thêm nhà cung cấp thành công', data: supplier });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!supplier) throw new AppError('Không tìm thấy nhà cung cấp', 404);
    const data = pickFields(req.body);
    if (!data.name) throw new AppError('Tên nhà cung cấp là bắt buộc');
    await supplier.update(data);
    res.json({ success: true, message: 'Cập nhật thành công', data: supplier });
  } catch (err) { next(err); }
};

/** Xóa NCC: các phiếu nhập cũ được giữ lại (bỏ liên kết NCC). */
exports.remove = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const supplier = await Supplier.findOne({ where: { id: req.params.id, userId: req.user.id }, transaction });
    if (!supplier) throw new AppError('Không tìm thấy nhà cung cấp', 404);
    if (toNumber(supplier.currentDebt) > 0) {
      throw new AppError(`Nhà cung cấp "${supplier.name}" đang còn khoản nợ cần trả ${toNumber(supplier.currentDebt).toLocaleString('vi-VN')}đ. Vui lòng tất toán nợ trước khi xóa!`);
    }
    await Purchase.update({ supplierId: null }, { where: { supplierId: supplier.id, userId: req.user.id }, transaction });
    await supplier.destroy({ transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Đã xóa nhà cung cấp' });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/** Thanh toán nợ cho Nhà cung cấp (ghi giảm nợ phải trả NCC) */
exports.payDebt = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const supplier = await Supplier.findOne({
      where: { id: req.params.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!supplier) throw new AppError('Không tìm thấy nhà cung cấp', 404);

    const payAmount = toNumber(req.body.amount);
    if (payAmount <= 0) {
      throw new AppError('Số tiền thanh toán phải lớn hơn 0');
    }

    const currentDebt = toNumber(supplier.currentDebt);
    if (currentDebt <= 0) {
      throw new AppError('Hiện không có nợ cần trả cho nhà cung cấp này');
    }

    if (payAmount > currentDebt) {
      throw new AppError(`Số tiền chi trả (${payAmount.toLocaleString('vi-VN')}đ) vượt quá nợ hiện tại (${currentDebt.toLocaleString('vi-VN')}đ)`);
    }

    const balanceBefore = currentDebt;
    const balanceAfter = Math.max(0, balanceBefore - payAmount);

    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const referenceCode = `PC${dateStr}${rand}`;

    const debtRecord = await DebtHistory.create({
      supplierId: supplier.id,
      userId: req.user.id,
      type: 'DECREASE',
      amount: payAmount,
      balanceBefore,
      balanceAfter,
      referenceCode,
      paymentMethod: req.body.paymentMethod || 'CASH',
      note: req.body.note || `Thanh toán nợ cho NCC ${supplier.name}`
    }, { transaction });

    await supplier.update({ currentDebt: balanceAfter }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Thanh toán nợ nhà cung cấp thành công',
      data: {
        supplier: {
          id: supplier.id,
          name: supplier.name,
          currentDebt: balanceAfter
        },
        debtHistory: debtRecord
      }
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
