const { Op } = require('sequelize');
const { Customer, Sale, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination } = require('../utils/query');

const pickFields = (body) => ({
  name: (body.name || '').trim(),
  phone: (body.phone || '').trim() || null,
  email: (body.email || '').trim() || null,
  address: (body.address || '').trim() || null
});

const ensureUniquePhone = async (userId, phone, excludeId) => {
  if (!phone) return;
  const where = { userId, phone };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const dup = await Customer.findOne({ where });
  if (dup) throw new AppError(`Số điện thoại đã thuộc về khách "${dup.name}"`);
};

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
    const { count, rows } = await Customer.findAndCountAll({
      where,
      attributes: {
        include: [[
          sequelize.literal(`(SELECT COUNT(*) FROM "Sales" s WHERE s."customerId" = "Customer"."id" AND s."status" = 'COMPLETED')`),
          'orderCount'
        ]]
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
    const customer = await Customer.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!customer) throw new AppError('Không tìm thấy khách hàng', 404);
    const sales = await Sale.findAll({
      where: { customerId: customer.id, userId: req.user.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ success: true, data: { ...customer.toJSON(), sales } });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = pickFields(req.body);
    if (!data.name) throw new AppError('Tên khách hàng là bắt buộc');
    await ensureUniquePhone(req.user.id, data.phone);
    const customer = await Customer.create({ ...data, userId: req.user.id });
    res.status(201).json({ success: true, message: 'Thêm khách hàng thành công', data: customer });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!customer) throw new AppError('Không tìm thấy khách hàng', 404);
    const data = pickFields(req.body);
    if (!data.name) throw new AppError('Tên khách hàng là bắt buộc');
    await ensureUniquePhone(req.user.id, data.phone, customer.id);
    await customer.update(data);
    res.json({ success: true, message: 'Cập nhật thành công', data: customer });
  } catch (err) { next(err); }
};

/** Xóa khách: các hóa đơn cũ được giữ lại và chuyển thành "Khách lẻ". */
exports.remove = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, userId: req.user.id }, transaction });
    if (!customer) throw new AppError('Không tìm thấy khách hàng', 404);
    await Sale.update({ customerId: null }, { where: { customerId: customer.id, userId: req.user.id }, transaction });
    await customer.destroy({ transaction });
    await transaction.commit();
    res.json({ success: true, message: 'Đã xóa khách hàng' });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
