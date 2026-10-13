const { Op } = require('sequelize');
const { Supplier, Purchase, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination } = require('../utils/query');

const pickFields = (body) => ({
  name: (body.name || '').trim(),
  phone: (body.phone || '').trim() || null,
  email: (body.email || '').trim() || null,
  address: (body.address || '').trim() || null
});

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 500, 1000);
    const { search } = req.query;
    const where = { userId: req.user.id };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } }
      ];
    }
    const { count, rows } = await Supplier.findAndCountAll({
      where,
      attributes: {
        include: [
          [sequelize.literal(`(SELECT COUNT(*) FROM "Purchases" p WHERE p."supplierId" = "Supplier"."id")`), 'purchaseCount'],
          [sequelize.literal(`(SELECT COALESCE(SUM(p."totalAmount"), 0) FROM "Purchases" p WHERE p."supplierId" = "Supplier"."id")`), 'totalPurchased']
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
    res.json({ success: true, data: { ...supplier.toJSON(), purchases } });
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
    await Purchase.update({ supplierId: null }, { where: { supplierId: supplier.id, userId: req.user.id }, transaction });
    await supplier.destroy({ transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Đã xóa nhà cung cấp' });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
