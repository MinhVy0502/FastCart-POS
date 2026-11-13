const { Op } = require('sequelize');
const { Product, Category, Shelf, Supplier, SaleItem, PurchaseItem, InventoryTransaction, ProductUnit, ProductBatch, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { getPaging, buildPagination, toNumber } = require('../utils/query');

const normalizeSku = (sku) => String(sku || '').trim().toUpperCase();

const pickFields = (body) => ({
  sku: normalizeSku(body.sku),
  barcode: body.barcode ? String(body.barcode).trim() : null,
  name: String(body.name || '').trim(),
  unit: body.unit ? String(body.unit).trim() : 'Cái',
  categoryId: body.categoryId || null,
  shelfId: body.shelfId || null,
  supplierId: body.supplierId || null,
  importPrice: Math.max(toNumber(body.importPrice), 0),
  salePrice: Math.max(toNumber(body.salePrice), 0),
  wholesalePrice: Math.max(toNumber(body.wholesalePrice), 0),
  minStock: Math.max(parseInt(body.minStock) || 0, 0),
  hasExpiryDate: Boolean(body.hasExpiryDate),
  expiryWarningDays: Math.max(parseInt(body.expiryWarningDays) || 30, 1)
});

const ensureCategory = async (userId, categoryId, transaction) => {
  if (!categoryId) return;
  const cat = await Category.findOne({ where: { id: categoryId, userId }, transaction });
  if (!cat) throw new AppError('Danh mục không tồn tại');
};

const ensureShelf = async (userId, shelfId, transaction) => {
  if (!shelfId) return;
  const shelf = await Shelf.findOne({ where: { id: shelfId, userId }, transaction });
  if (!shelf) throw new AppError('Kệ hàng không tồn tại');
};

const ensureSupplier = async (userId, supplierId, transaction) => {
  if (!supplierId) return;
  const supplier = await Supplier.findOne({ where: { id: supplierId, userId }, transaction });
  if (!supplier) throw new AppError('Nhà cung cấp không tồn tại');
};

const syncProductUnits = async (productId, userId, units, transaction) => {
  if (!Array.isArray(units)) return;
  await ProductUnit.destroy({ where: { productId, userId }, transaction });
  for (const u of units) {
    const unitName = String(u.unitName || '').trim();
    const factor = parseInt(u.conversionFactor) || 1;
    if (unitName && factor > 1) {
      await ProductUnit.create({
        productId,
        userId,
        unitName,
        conversionFactor: factor,
        barcode: u.barcode ? String(u.barcode).trim() : null,
        salePrice: Math.max(toNumber(u.salePrice), 0),
        wholesalePrice: Math.max(toNumber(u.wholesalePrice), 0),
        isDefault: Boolean(u.isDefault)
      }, { transaction });
    }
  }
};

exports.getAll = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPaging(req.query, 10, 2000);
    const { search, categoryId, shelfId, supplierId, lowStock, sort, hasExpiry } = req.query;

    const where = { userId: req.user.id };
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } }
      ];
    }
    if (categoryId) where.categoryId = categoryId;
    if (shelfId) where.shelfId = shelfId;
    if (supplierId) where.supplierId = supplierId;
    if (hasExpiry === 'true') where.hasExpiryDate = true;
    if (lowStock === 'true') where.currentStock = { [Op.lte]: sequelize.col('minStock') };

    const order = sort === 'name' ? [['name', 'ASC']]
      : sort === 'stock' ? [['currentStock', 'ASC']]
      : [['createdAt', 'DESC']];

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
        { model: ProductUnit, as: 'units' },
        { model: ProductBatch, as: 'batches', where: { currentQuantity: { [Op.gt]: 0 } }, required: false }
      ],
      order,
      limit,
      offset,
      distinct: true
    });

    res.json({ success: true, data: rows, pagination: buildPagination(count, page, limit) });
  } catch (err) { next(err); }
};

/** Tra cứu chính xác theo mã vạch hoặc SKU (bao gồm cả mã vạch của đơn vị quy đổi) */
exports.getBySku = async (req, res, next) => {
  try {
    const raw = String(req.params.sku || '').trim();
    const query = normalizeSku(raw);

    // 1. Kiểm tra SKU hoặc Barcode chính của sản phẩm
    let product = await Product.findOne({
      where: {
        userId: req.user.id,
        [Op.or]: [
          { sku: { [Op.iLike]: query } },
          { barcode: { [Op.iLike]: raw } }
        ]
      },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
        { model: ProductUnit, as: 'units' },
        { model: ProductBatch, as: 'batches', where: { currentQuantity: { [Op.gt]: 0 } }, required: false }
      ]
    });

    let matchedUnit = null;

    // 2. Nếu không thấy, kiểm tra xem mã vạch có thuộc về Đơn vị quy đổi (ProductUnit) nào không
    if (!product) {
      const unitMatch = await ProductUnit.findOne({
        where: { userId: req.user.id, barcode: { [Op.iLike]: raw } },
        include: [{
          model: Product,
          as: 'product',
          include: [
            { model: Category, as: 'category', attributes: ['id', 'name'] },
            { model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] },
            { model: Supplier, as: 'supplier', attributes: ['id', 'name', 'phone'] },
            { model: ProductUnit, as: 'units' },
            { model: ProductBatch, as: 'batches', where: { currentQuantity: { [Op.gt]: 0 } }, required: false }
          ]
        }]
      });

      if (unitMatch && unitMatch.product) {
        product = unitMatch.product;
        matchedUnit = unitMatch;
      }
    }

    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    res.json({
      success: true,
      data: product,
      matchedUnit: matchedUnit ? {
        id: matchedUnit.id,
        unitName: matchedUnit.unitName,
        conversionFactor: matchedUnit.conversionFactor,
        salePrice: matchedUnit.salePrice,
        wholesalePrice: matchedUnit.wholesalePrice,
        barcode: matchedUnit.barcode
      } : null
    });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Category, as: 'category' },
        { model: Shelf, as: 'shelf' },
        { model: Supplier, as: 'supplier' },
        { model: ProductUnit, as: 'units' },
        { model: ProductBatch, as: 'batches' }
      ]
    });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: product });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const data = pickFields(req.body);
    if (!data.name) throw new AppError('Tên sản phẩm là bắt buộc');
    if (!data.sku) {
      data.sku = `SP${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    }
    await ensureCategory(req.user.id, data.categoryId, transaction);
    await ensureShelf(req.user.id, data.shelfId, transaction);
    await ensureSupplier(req.user.id, data.supplierId, transaction);

    const existingSku = await Product.findOne({ where: { sku: data.sku, userId: req.user.id }, transaction });
    if (existingSku) throw new AppError('Mã SKU đã tồn tại');

    if (data.barcode) {
      const existingBarcode = await Product.findOne({ where: { barcode: data.barcode, userId: req.user.id }, transaction });
      if (existingBarcode) throw new AppError('Mã vạch (Barcode) đã được dùng cho sản phẩm khác');
    }

    const initialStock = Math.max(parseInt(req.body.currentStock) || 0, 0);
    const product = await Product.create({ ...data, currentStock: initialStock, userId: req.user.id }, { transaction });

    if (initialStock > 0) {
      await InventoryTransaction.create({
        productId: product.id,
        type: 'ADJUST',
        quantity: initialStock,
        referenceCode: 'INIT',
        note: 'Tồn kho ban đầu khi tạo sản phẩm'
      }, { transaction });
    }

    // Lưu các đơn vị quy đổi nếu có
    await syncProductUnits(product.id, req.user.id, req.body.units, transaction);

    await transaction.commit();

    const created = await Product.findOne({
      where: { id: product.id },
      include: [
        { model: Category, as: 'category' },
        { model: Shelf, as: 'shelf' },
        { model: Supplier, as: 'supplier' },
        { model: ProductUnit, as: 'units' }
      ]
    });

    res.status(201).json({ success: true, message: 'Thêm sản phẩm thành công', data: created });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

exports.update = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const product = await Product.findOne({ where: { id: req.params.id, userId: req.user.id }, transaction });
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const data = pickFields(req.body);
    if (!data.sku || !data.name) throw new AppError('Mã SKU và tên sản phẩm là bắt buộc');
    await ensureCategory(req.user.id, data.categoryId, transaction);
    await ensureShelf(req.user.id, data.shelfId, transaction);
    await ensureSupplier(req.user.id, data.supplierId, transaction);

    if (data.sku !== product.sku) {
      const existingSku = await Product.findOne({ where: { sku: data.sku, userId: req.user.id }, transaction });
      if (existingSku) throw new AppError('Mã SKU đã tồn tại');
    }

    if (data.barcode && data.barcode !== product.barcode) {
      const existingBarcode = await Product.findOne({ where: { barcode: data.barcode, userId: req.user.id }, transaction });
      if (existingBarcode) throw new AppError('Mã vạch (Barcode) đã được dùng cho sản phẩm khác');
    }

    await product.update(data, { transaction });

    // Đồng bộ đơn vị tính quy đổi
    if (req.body.units !== undefined) {
      await syncProductUnits(product.id, req.user.id, req.body.units, transaction);
    }

    await transaction.commit();

    const updated = await Product.findOne({
      where: { id: product.id },
      include: [
        { model: Category, as: 'category' },
        { model: Shelf, as: 'shelf' },
        { model: Supplier, as: 'supplier' },
        { model: ProductUnit, as: 'units' },
        { model: ProductBatch, as: 'batches' }
      ]
    });

    res.json({ success: true, message: 'Cập nhật thành công', data: updated });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
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
 * Lấy danh sách lô hàng & hạn sử dụng của sản phẩm
 */
exports.getBatches = async (req, res, next) => {
  try {
    const product = await Product.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const batches = await ProductBatch.findAll({
      where: { productId: product.id, userId: req.user.id },
      order: [['expiryDate', 'ASC']]
    });

    res.json({ success: true, data: batches });
  } catch (err) { next(err); }
};

/**
 * Thêm lô hàng mới trực tiếp cho sản phẩm
 */
exports.addBatch = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const product = await Product.findOne({ where: { id: req.params.id, userId: req.user.id }, transaction });
    if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);

    const { batchNumber, expiryDate, manufacturingDate, quantity, initialQuantity, note } = req.body;
    const qty = parseInt(quantity !== undefined ? quantity : initialQuantity);
    if (!batchNumber || !expiryDate) throw new AppError('Số lô và Hạn sử dụng là bắt buộc');
    if (!Number.isInteger(qty) || qty <= 0) throw new AppError('Số lượng phải là số nguyên dương');

    const batch = await ProductBatch.create({
      productId: product.id,
      userId: req.user.id,
      batchNumber: String(batchNumber).trim(),
      manufacturingDate: manufacturingDate ? new Date(manufacturingDate) : null,
      expiryDate: new Date(expiryDate),
      initialQuantity: qty,
      currentQuantity: qty,
      note: note ? String(note).trim() : null
    }, { transaction });

    // Tăng tồn kho sản phẩm
    await product.update({
      currentStock: product.currentStock + qty,
      hasExpiryDate: true
    }, { transaction });

    // Ghi nhận biến động kho
    await InventoryTransaction.create({
      productId: product.id,
      type: 'IN',
      quantity: qty,
      referenceCode: `LO-${batch.batchNumber}`,
      note: `Thêm lô hàng mới: ${batch.batchNumber} (HSD: ${new Date(expiryDate).toLocaleDateString('vi-VN')})`
    }, { transaction });

    await transaction.commit();
    res.status(201).json({ success: true, message: 'Thêm lô hàng thành công', data: batch });
  } catch (err) {
    await transaction.rollback();
    next(err);
  }
};

/**
 * Lấy danh sách sản phẩm / lô hàng sắp hết hạn (Cảnh báo HSD)
 */
exports.getExpiringProducts = async (req, res, next) => {
  try {
    const days = Math.max(parseInt(req.query.days) || 30, 1);
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);

    const batches = await ProductBatch.findAll({
      where: {
        userId: req.user.id,
        currentQuantity: { [Op.gt]: 0 },
        expiryDate: { [Op.lte]: targetDate }
      },
      include: [{
        model: Product,
        as: 'product',
        attributes: ['id', 'sku', 'barcode', 'name', 'unit', 'currentStock', 'shelfId'],
        include: [{ model: Shelf, as: 'shelf', attributes: ['id', 'name', 'code'] }]
      }],
      order: [['expiryDate', 'ASC']]
    });

    const now = new Date();
    const formatted = batches.map(b => {
      const exp = new Date(b.expiryDate);
      const diffTime = exp.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        id: b.id,
        productId: b.productId,
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate,
        manufacturingDate: b.manufacturingDate,
        currentQuantity: b.currentQuantity,
        daysLeft: diffDays,
        isExpired: diffDays <= 0,
        product: b.product
      };
    });

    const nearExpiryCount = formatted.filter(b => !b.isExpired).length;
    const expiredCount = formatted.filter(b => b.isExpired).length;

    res.json({
      success: true,
      data: formatted,
      summary: {
        totalExpiring: formatted.length,
        nearExpiryCount,
        expiredCount,
        totalExpired: expiredCount
      }
    });
  } catch (err) { next(err); }
};

/**
 * Lấy lịch sử biến động kho (Audit Trail) của sản phẩm
 */
exports.getHistory = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'name'] }
      ]
    });
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const { page, limit, offset } = getPaging(req.query, 20, 100);
    const { type } = req.query; // IN, OUT, ADJUST

    const where = { productId: product.id };
    if (type) where.type = type;

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          unit: product.unit,
          currentStock: product.currentStock,
          category: product.category,
          supplier: product.supplier
        },
        transactions: rows,
        pagination: buildPagination(count, page, limit)
      }
    });
  } catch (err) { next(err); }
};

/**
 * Nhập hàng loạt từ Excel.
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

    const supplierCache = {};
    const getSupplierId = async (name) => {
      const key = String(name || '').trim();
      if (!key) return null;
      if (supplierCache[key.toLowerCase()]) return supplierCache[key.toLowerCase()];
      let sup = await Supplier.findOne({ where: { userId: req.user.id, name: { [Op.iLike]: key } }, transaction });
      if (!sup) sup = await Supplier.create({ name: key, userId: req.user.id }, { transaction });
      supplierCache[key.toLowerCase()] = sup.id;
      return sup.id;
    };

    let created = 0, updated = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const sku = normalizeSku(r.sku || r['Mã SKU'] || r['SKU']);
      const name = String(r.name || r['Tên sản phẩm'] || r['Tên hàng'] || '').trim();
      if (!sku || !name) {
        errors.push(`Dòng ${i + 2}: thiếu SKU hoặc tên`);
        continue;
      }

      const barcodeRaw = r.barcode || r['Mã vạch'] || r['Barcode'] || null;
      const barcode = barcodeRaw ? String(barcodeRaw).trim() : null;
      const unit = String(r.unit || r['Đơn vị tính'] || r['ĐVT'] || 'Cái').trim() || 'Cái';
      const categoryName = r.category || r['Danh mục'] || r['Ngành hàng'] || null;
      const supplierName = r.supplier || r['Nhà cung cấp'] || r['NCC'] || null;

      const categoryId = await getCategoryId(categoryName);
      const supplierId = await getSupplierId(supplierName);

      const data = {
        name,
        barcode,
        unit,
        categoryId,
        supplierId,
        importPrice: Math.max(toNumber(r.importPrice || r['Giá nhập']), 0),
        salePrice: Math.max(toNumber(r.salePrice || r['Giá bán'] || r['Giá bán lẻ']), 0),
        wholesalePrice: Math.max(toNumber(r.wholesalePrice || r['Giá sỉ']), 0),
        minStock: Math.max(parseInt(r.minStock || r['Tồn tối thiểu']) || 10, 0)
      };

      // Parse quy cách đóng gói (ProductUnit) nếu có từ file Excel
      let parsedUnits = null;
      if (Array.isArray(r.units)) {
        parsedUnits = r.units;
      } else {
        const rawUnitsText = String(r.unitsText || r['Quy cách đóng gói'] || r['ĐVT quy đổi'] || '').trim();
        if (rawUnitsText) {
          parsedUnits = rawUnitsText
            .split(/[|;]/)
            .map((part) => part.trim())
            .filter(Boolean)
            .map((part) => {
              const [uName, uFactor, uSale, uWs, uBarcode] = part.split(':').map((s) => s.trim());
              const factor = parseInt(uFactor) || 1;
              return {
                unitName: uName,
                conversionFactor: factor,
                salePrice: uSale !== undefined && uSale !== '' ? toNumber(uSale) : data.salePrice * factor,
                wholesalePrice: uWs !== undefined && uWs !== '' ? toNumber(uWs) : data.wholesalePrice * factor,
                barcode: uBarcode || null
              };
            })
            .filter((u) => u.unitName && u.conversionFactor > 1);
        }
      }

      const existing = await Product.findOne({ where: { userId: req.user.id, sku }, transaction });
      if (existing) {
        await existing.update(data, { transaction });
        if (parsedUnits) {
          await syncProductUnits(existing.id, req.user.id, parsedUnits, transaction);
        }
        updated++;
      } else {
        const initialStock = Math.max(parseInt(r.currentStock || r['Tồn kho'] || r['Tồn hiện tại']) || 0, 0);
        const product = await Product.create({ ...data, sku, currentStock: initialStock, userId: req.user.id }, { transaction });
        if (parsedUnits && parsedUnits.length > 0) {
          await syncProductUnits(product.id, req.user.id, parsedUnits, transaction);
        }
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
