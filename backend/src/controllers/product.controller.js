const { Op } = require('sequelize');
const { Product, Category, Shelf, SaleItem, PurchaseItem, InventoryTransaction, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, toNumber } = require('../utils/query');

const normalizeSku = (sku) => String(sku || '').trim().toUpperCase();

const pickFields = (body) => ({
  sku: normalizeSku(body.sku),
  name: String(body.name || '').trim(),
  categoryId: body.categoryId || null,
  shelfId: body.shelfId || null,
  importPrice: Math.max(toNumber(body.importPrice), 0),
  salePrice: Math.max(toNumber(body.salePrice), 0),
  minStock: Math.max(parseInt(body.minStock) || 0, 0)
});

const ensureCategory = async (userId, categoryId) => {
  if (!categoryId) return;
  const cat = await Category.findOne({ where: { id: categoryId, userId } });
  if (!cat) throw new AppError('Danh mục không tồn tại');
};

const ensureShelf = async (userId, shelfId) => {
  if (!shelfId) return;
  const shelf = await Shelf.findOne({ where: { id: shelfId, userId } });
  if (!shelf) throw new AppError('Kệ hàng không tồn tại');
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 10, 2000);
    const { search, categoryId, shelfId, lowStock, sort } = req.query;

    const where = { userId: req.user.id };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (shelfId) where.shelfId = shelfId;
    if (lowStock === 'true') where.currentStock = { [Op.lte]: sequelize.col('minStock') };

    const order = sort === 'name' ? [['name', 'ASC']]
      : sort === 'stock' ? [['currentStock', 'ASC']]
      : [['createdAt', 'DESC']];

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] }
      ],
      order,
      limit,
      offset
    });

    res.json({ success: true, data: rows, pagination: buildPagination(count, page, limit) });
  } catch (err) { next(err); }
};

/** Tra cứu chính xác theo mã vạch/SKU – dùng cho máy quét. */
exports.getBySku = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { userId: req.user.id, sku: { [Op.iLike]: normalizeSku(req.params.sku) } },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] }
      ]
    });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Category, as: 'category' },
        { model: Shelf, as: 'shelf' }
      ]
    });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const data = pickFields(req.body);
    if (!data.sku || !data.name) throw new AppError('Mã SKU và tên sản phẩm là bắt buộc');
    await ensureCategory(req.user.id, data.categoryId);
    await ensureShelf(req.user.id, data.shelfId);

    const existing = await Product.findOne({ where: { sku: data.sku, userId: req.user.id } });
    if (existing) throw new AppError('Mã SKU đã tồn tại');

    const product = await Product.create({ ...data, userId: req.user.id });
    res.status(201).json({ success: true, message: 'Thêm sản phẩm thành công', data: product });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const data = pickFields(req.body);
    if (!data.sku || !data.name) throw new AppError('Mã SKU và tên sản phẩm là bắt buộc');
    await ensureCategory(req.user.id, data.categoryId);
    await ensureShelf(req.user.id, data.shelfId);

    if (data.sku !== product.sku) {
      const existing = await Product.findOne({ where: { sku: data.sku, userId: req.user.id } });
      if (existing) throw new AppError('Mã SKU đã tồn tại');
    }

    await product.update(data);
    res.json({ success: true, message: 'Cập nhật thành công', data: product });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const used = (await SaleItem.count({ where: { productId: product.id } }))
      + (await PurchaseItem.count({ where: { productId: product.id } }));
    if (used > 0) {
      throw new AppError('Sản phẩm đã phát sinh hóa đơn/phiếu nhập nên không thể xóa (để giữ lịch sử).');
    }

    await product.destroy();
    res.json({ success: true, message: 'Xóa sản phẩm thành công' });
  } catch (err) { next(err); }
};

/**
 * Nhập hàng loạt từ Excel.
 * Body: { rows: [{ sku, name, category, importPrice, salePrice, minStock, currentStock }] }
 * - SKU đã tồn tại → cập nhật thông tin (không đổi tồn kho)
 * - SKU mới → tạo mới, tồn kho ban đầu = currentStock
 */
exports.bulkImport = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (rows.length === 0) throw new AppError('File không có dữ liệu');
    if (rows.length > 2000) throw new AppError('Tối đa 2000 dòng mỗi lần nhập');

    const categoryCache = {};
    const getCategoryId = async (name) => {
      const key = String(name || '').trim();
      if (!key) return null;
      if (categoryCache[key.toLowerCase()]) return categoryCache[key.toLowerCase()];
      let cat = await Category.findOne({ where: { userId: req.user.id, name: { [Op.iLike]: key } }, transaction });
      if (!cat) cat = await Category.create({ name: key, userId: req.user.id }, { transaction });
      categoryCache[key.toLowerCase()] = cat.id;
      return cat.id;
    };

    let created = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const sku = normalizeSku(r.sku);
      const name = String(r.name || '').trim();
      if (!sku || !name) {
        errors.push(`Dòng ${i + 2}: thiếu SKU hoặc tên`);
        continue;
      }
      const categoryId = await getCategoryId(r.category);
      const data = {
        name,
        categoryId,
        importPrice: Math.max(toNumber(r.importPrice), 0),
        salePrice: Math.max(toNumber(r.salePrice), 0),
        minStock: Math.max(parseInt(r.minStock) || 10, 0)
      };

      const existing = await Product.findOne({ where: { userId: req.user.id, sku }, transaction });
      if (existing) {
        await existing.update(data, { transaction });
        updated++;
      } else {
        const initialStock = Math.max(parseInt(r.currentStock) || 0, 0);
        const product = await Product.create({ ...data, sku, currentStock: initialStock, userId: req.user.id }, { transaction });
        if (initialStock > 0) {
          await InventoryTransaction.create({
            productId: product.id, type: 'ADJUST', quantity: initialStock,
            referenceCode: 'EXCEL', note: 'Tồn kho ban đầu (nhập từ Excel)'
          }, { transaction });
        }
        created++;
      }
    }

    await transaction.commit();
    res.json({
      success: true,
      message: `Đã thêm ${created} và cập nhật ${updated} sản phẩm`,
      data: { created, updated, errors }
    });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};
