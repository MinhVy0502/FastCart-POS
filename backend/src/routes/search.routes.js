const express = require('express');
const { Op } = require('sequelize');
const { Product, Sale, Customer, Shelf } = require('../models');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(protect);

/** Tìm kiếm toàn cục: sản phẩm, hóa đơn, khách hàng. */
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 1) return res.json({ success: true, data: { products: [], sales: [], customers: [] } });
    const like = { [Op.iLike]: `%${q}%` };
    const userId = req.user.id;

    const [products, sales, customers] = await Promise.all([
      Product.findAll({
        where: { userId, [Op.or]: [{ name: like }, { sku: like }] },
        attributes: ['id', 'name', 'sku', 'salePrice', 'currentStock', 'shelfId'],
        include: [{ model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] }],
        limit: 6
      }),
      Sale.findAll({
        where: { userId, code: like },
        attributes: ['id', 'code', 'finalAmount', 'status', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: 5
      }),
      Customer.findAll({
        where: { userId, [Op.or]: [{ name: like }, { phone: like }] },
        attributes: ['id', 'name', 'phone'],
        limit: 5
      })
    ]);

    res.json({ success: true, data: { products, sales, customers } });
  } catch (err) { next(err); }
});

module.exports = router;
