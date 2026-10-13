const { Shelf, Product, sequelize } = require('../models');

exports.getAll = async (req, res, next) => {
  try {
    const shelves = await Shelf.findAll({
      where: { userId: req.user.id },
      attributes: {
        include: [
          [
            sequelize.literal(`(
              SELECT COUNT(*)::int
              FROM "Products" AS p
              WHERE p."shelfId" = "Shelf"."id"
            )`),
            'productCount'
          ]
        ]
      },
      order: [['name', 'ASC']]
    });
    res.json({ success: true, data: shelves });
  } catch (err) {
    next(err);
  }
};

exports.getOne = async (req, res, next) => {
  try {
    const shelf = await Shelf.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'sku', 'name', 'salePrice', 'currentStock', 'imageUrl']
        }
      ]
    });
    if (!shelf) return res.status(404).json({ success: false, message: 'Không tìm thấy kệ hàng' });
    res.json({ success: true, data: shelf });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { name, code, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên kệ hàng là bắt buộc' });
    }

    const shelf = await Shelf.create({
      name: name.trim(),
      code: code ? code.trim() : null,
      description: description ? description.trim() : null,
      userId: req.user.id
    });
    res.status(201).json({ success: true, message: 'Tạo kệ hàng thành công', data: shelf });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const shelf = await Shelf.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!shelf) return res.status(404).json({ success: false, message: 'Không tìm thấy kệ hàng' });

    const { name, code, description } = req.body;
    if (name !== undefined && !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên kệ hàng không được để trống' });
    }

    await shelf.update({
      name: name !== undefined ? name.trim() : shelf.name,
      code: code !== undefined ? (code ? code.trim() : null) : shelf.code,
      description: description !== undefined ? (description ? description.trim() : null) : shelf.description
    });
    res.json({ success: true, message: 'Cập nhật kệ hàng thành công', data: shelf });
  } catch (err) {
    next(err);
  }
};

exports.remove = async (req, res, next) => {
  try {
    const shelf = await Shelf.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!shelf) return res.status(404).json({ success: false, message: 'Không tìm thấy kệ hàng' });

    // Đặt shelfId của các sản phẩm trên kệ này về null
    await Product.update({ shelfId: null }, { where: { shelfId: shelf.id } });
    await shelf.destroy();
    res.json({ success: true, message: 'Xóa kệ hàng thành công' });
  } catch (err) {
    next(err);
  }
};
