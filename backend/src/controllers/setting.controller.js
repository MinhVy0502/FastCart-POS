const { Setting, User } = require('../models');

const FIELDS = ['storeName', 'address', 'phone', 'logoUrl', 'receiptFooter', 'paperSize', 'bankBin', 'bankAccount', 'bankAccountName'];
const PAPER_SIZES = ['58mm', '80mm', 'A4'];

const getOrCreate = async (userId) => {
  let setting = await Setting.findOne({ where: { userId } });
  if (!setting) {
    const user = await User.findByPk(userId, { attributes: ['name', 'phone'] });
    setting = await Setting.create({
      userId,
      storeName: user?.name ? `Cửa hàng ${user.name}` : 'Cửa hàng của tôi',
      phone: user?.phone || null,
      paperSize: '80mm',
      receiptFooter: 'Cảm ơn quý khách và hẹn gặp lại!'
    });
  }
  return setting;
};

exports.get = async (req, res, next) => {
  try {
    const setting = await getOrCreate(req.user.id);
    res.json({ success: true, data: setting });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const setting = await getOrCreate(req.user.id);
    const data = {};
    for (const f of FIELDS) {
      if (req.body[f] !== undefined) data[f] = typeof req.body[f] === 'string' ? req.body[f].trim() : req.body[f];
    }
    if (data.paperSize && !PAPER_SIZES.includes(data.paperSize)) data.paperSize = '80mm';
    if (data.storeName === '') {
      return res.status(400).json({ success: false, message: 'Tên cửa hàng không được để trống' });
    }
    await setting.update(data);
    res.json({ success: true, message: 'Đã lưu cài đặt', data: setting });
  } catch (err) { next(err); }
};
