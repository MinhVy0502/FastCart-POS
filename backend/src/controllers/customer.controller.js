const { Op } = require('sequelize');
const { Customer, Sale, DebtHistory, User, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, toNumber } = require('../utils/query');

const pickFields = (body) => ({
  name: (body.name || '').trim(),
  customerType: ['RETAIL', 'WHOLESALE'].includes(body.customerType) ? body.customerType : 'RETAIL',
  storeName: (body.storeName || '').trim() || null,
  phone: (body.phone || '').trim() || null,
  email: (body.email || '').trim() || null,
  address: (body.address || '').trim() || null,
  debtLimit: Math.max(toNumber(body.debtLimit), 0)
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
    const { search, customerType, hasDebt } = req.query;
    const where = { userId: req.user.id };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { storeName: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (customerType) {
      where.customerType = customerType;
    }
    if (hasDebt === 'true') {
      where.currentDebt = { [Op.gt]: 0 };
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
    const debts = await DebtHistory.findAll({
      where: { customerId: customer.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    res.json({ success: true, data: { ...customer.toJSON(), sales, debts } });
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

/** Lấy lịch sử biến động công nợ của khách hàng */
exports.getDebtHistory = async (req, res, next) => {
  try {
    const customer = await Customer.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!customer) throw new AppError('Không tìm thấy khách hàng', 404);

    const { page, limit, offset } = getPaging(req.query, 20, 100);
    const { count, rows } = await DebtHistory.findAndCountAll({
      where: { customerId: customer.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: rows,
      customer: {
        id: customer.id,
        name: customer.name,
        storeName: customer.storeName,
        customerType: customer.customerType,
        currentDebt: toNumber(customer.currentDebt),
        debtLimit: toNumber(customer.debtLimit)
      },
      pagination: buildPagination(count, page, limit)
    });
  } catch (err) { next(err); }
};

/** Thu tiền nợ khách hàng (ghi giảm công nợ) */
exports.payDebt = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const customer = await Customer.findOne({
      where: { id: req.params.id, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!customer) throw new AppError('Không tìm thấy khách hàng', 404);

    const payAmount = toNumber(req.body.amount);
    if (payAmount <= 0) {
      throw new AppError('Số tiền thanh toán phải lớn hơn 0');
    }

    const currentDebt = toNumber(customer.currentDebt);
    if (currentDebt <= 0) {
      throw new AppError('Khách hàng hiện không có nợ');
    }

    if (payAmount > currentDebt) {
      throw new AppError(`Số tiền thu (${payAmount.toLocaleString('vi-VN')}đ) vượt quá số nợ hiện tại (${currentDebt.toLocaleString('vi-VN')}đ)`);
    }

    const balanceBefore = currentDebt;
    const balanceAfter = Math.max(0, balanceBefore - payAmount);

    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const referenceCode = `PT${dateStr}${rand}`;

    const debtRecord = await DebtHistory.create({
      customerId: customer.id,
      userId: req.user.id,
      type: 'DECREASE',
      amount: payAmount,
      balanceBefore,
      balanceAfter,
      referenceCode,
      paymentMethod: req.body.paymentMethod || 'CASH',
      note: req.body.note || 'Thu tiền nợ khách hàng'
    }, { transaction });

    await customer.update({ currentDebt: balanceAfter }, { transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: 'Thu tiền nợ thành công',
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
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

