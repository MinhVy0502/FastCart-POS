const { Op } = require('sequelize');
const { InventoryTransaction, Product, ProductBatch, sequelize } = require('../models');
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
        attributes: ['id', 'name', 'sku', 'barcode', 'unit'],
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
 * Body: { productId, actualStock, reason, batchId? }
 * Ghi giao dịch ADJUST với quantity = chênh lệch (có thể âm) và tự động đồng bộ tồn các lô (ProductBatch).
 */
exports.adjust = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const { productId, batchId } = req.body;
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

    // Đồng bộ số lượng tồn trên các lô hàng (ProductBatch) nếu sản phẩm có lô
    let batchNote = '';
    if (batchId) {
      const targetBatch = await ProductBatch.findOne({
        where: { id: batchId, productId: product.id, userId: req.user.id },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (targetBatch) {
        if (delta > 0) {
          await targetBatch.update({ currentQuantity: targetBatch.currentQuantity + delta }, { transaction });
          batchNote = ` [Lô ${targetBatch.batchNumber}]`;
        } else {
          let toDeduct = Math.abs(delta);
          const deductHere = Math.min(targetBatch.currentQuantity, toDeduct);
          await targetBatch.update({ currentQuantity: targetBatch.currentQuantity - deductHere }, { transaction });
          toDeduct -= deductHere;
          batchNote = ` [Lô ${targetBatch.batchNumber}]`;

          if (toDeduct > 0) {
            const otherBatches = await ProductBatch.findAll({
              where: { productId: product.id, userId: req.user.id, id: { [Op.ne]: targetBatch.id }, currentQuantity: { [Op.gt]: 0 } },
              order: [['expiryDate', 'ASC']],
              transaction,
              lock: transaction.LOCK.UPDATE
            });
            for (const ob of otherBatches) {
              if (toDeduct <= 0) break;
              const d = Math.min(ob.currentQuantity, toDeduct);
              await ob.update({ currentQuantity: ob.currentQuantity - d }, { transaction });
              toDeduct -= d;
            }
          }
        }
      }
    } else {
      const batches = await ProductBatch.findAll({
        where: { productId: product.id, userId: req.user.id },
        order: [['expiryDate', 'ASC']],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (batches.length > 0) {
        if (delta < 0) {
          let toDeduct = Math.abs(delta);
          for (const b of batches) {
            if (toDeduct <= 0) break;
            if (b.currentQuantity <= 0) continue;
            const d = Math.min(b.currentQuantity, toDeduct);
            await b.update({ currentQuantity: b.currentQuantity - d }, { transaction });
            toDeduct -= d;
          }
        } else if (delta > 0) {
          const lastBatch = batches[batches.length - 1];
          await lastBatch.update({ currentQuantity: lastBatch.currentQuantity + delta }, { transaction });
          batchNote = ` [Lô ${lastBatch.batchNumber}]`;
        }
      }
    }

    await product.update({ currentStock: actualStock }, { transaction });
    await InventoryTransaction.create({
      productId: product.id,
      type: 'ADJUST',
      quantity: delta,
      referenceCode: 'KIEMKE',
      note: `Kiểm kê${batchNote}: ${reason} (từ ${actualStock - delta} → ${actualStock})`
    }, { transaction });

    await transaction.commit();
    res.json({ success: true, message: 'Đã điều chỉnh tồn kho', data: product });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
