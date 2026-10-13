const { InventoryTransaction, Product, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, dateRange } = require('../utils/query');

const TYPES = ['IN', 'OUT', 'ADJUST'];

exports.getTransactions = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 50, 500);
    const { type, productId, from, to } = req.query;

    const where = {};
    if (TYPES.includes(type)) where.type = type;
    if (productId) where.productId = productId;
    const created = dateRange(from, to);
    if (created) where.createdAt = created;

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'name', 'sku'],
        where: { userId: req.user.id }
      }],
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
    res.json({ success: true, data: rows, pagination: buildPagination(count, page, limit) });
  } catch (err) { next(err); }
};

/**
 * Kiểm kê / điều chỉnh tồn kho.
 * Body: { productId, actualStock, reason }
 * Ghi giao dịch ADJUST với quantity = chênh lệch (có thể âm).
 */
exports.adjust = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { productId } = req.body;
    const actualStock = parseInt(req.body.actualStock);
    const reason = String(req.body.reason || '').trim();

    if (!Number.isInteger(actualStock) || actualStock < 0) throw new AppError('Số lượng thực tế không hợp lệ');
    if (!reason) throw new AppError('Vui lòng nhập lý do điều chỉnh');

    const product = await Product.findOne({
      where: { id: productId, userId: req.user.id },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!product) throw new AppError('Sản phẩm không tồn tại', 404);

    const delta = actualStock - product.currentStock;
    if (delta === 0) throw new AppError('Tồn kho không thay đổi');

    await product.update({ currentStock: actualStock }, { transaction });
    await InventoryTransaction.create({
      productId: product.id,
      type: 'ADJUST',
      quantity: delta,
      referenceCode: 'KIEMKE',
      note: `Kiểm kê: ${reason} (từ ${actualStock - delta} → ${actualStock})`
    }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Đã điều chỉnh tồn kho', data: product });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
