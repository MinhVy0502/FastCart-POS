const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { protect } = require('../middlewares/auth.middleware');

const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`)
  }),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    const err = new Error('Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF');
    err.isAppError = true;
    err.status = 400;
    cb(err);
  }
});

const router = express.Router();
router.use(protect);

router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'Chưa chọn ảnh' });
  res.status(201).json({ success: true, data: { url: `/uploads/${req.file.filename}` } });
});

module.exports = router;
