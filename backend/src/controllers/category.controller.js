const { Category } = require('../models');

exports.getAll = async (req, res, next) => {
  try {
    const categories = await Category.findAll({ 
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']] 
    });
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
};

exports.getOne = async (req, res, next) => {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Tên danh mục là bắt buộc' });
    
    const category = await Category.create({ name, description, userId: req.user.id });
    res.status(201).json({ success: true, message: 'Tạo danh mục thành công', data: category });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const category = await Category.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    
    await category.update({ name, description });
    res.json({ success: true, message: 'Cập nhật thành công', data: category });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const category = await Category.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!category) return res.status(404).json({ success: false, message: 'Không tìm thấy danh mục' });
    
    await category.destroy();
    res.json({ success: true, message: 'Xóa danh mục thành công' });
  } catch (err) { next(err); }
};
