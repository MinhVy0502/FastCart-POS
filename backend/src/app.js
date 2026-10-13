const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

app.use(cors());
// Cho phép ảnh sản phẩm (/uploads) được tải từ origin của frontend
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to DailyBanLe API' });
});

const { purchaseRouter, saleRouter } = require('./routes/transaction.routes');

// Routes
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/categories', require('./routes/category.routes'));
app.use('/api/v1/shelves', require('./routes/shelf.routes'));
app.use('/api/v1/products', require('./routes/product.routes'));
app.use('/api/v1/suppliers', require('./routes/supplier.routes'));
app.use('/api/v1/customers', require('./routes/customer.routes'));
app.use('/api/v1/purchases', purchaseRouter);
app.use('/api/v1/sales', saleRouter);
app.use('/api/v1/analytics', require('./routes/analytics.routes'));
app.use('/api/v1/inventory', require('./routes/inventory.routes'));
app.use('/api/v1/settings', require('./routes/setting.routes'));
app.use('/api/v1/search', require('./routes/search.routes'));
app.use('/api/v1/uploads', require('./routes/upload.routes'));

app.use((err, req, res, next) => {
  // Lỗi nghiệp vụ (AppError) → trả nguyên thông báo
  if (err.isAppError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  // Lỗi upload file
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'Ảnh vượt quá 2MB' : err.message });
  }
  // Lỗi ràng buộc dữ liệu thường gặp
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ success: false, message: 'Dữ liệu bị trùng (mã đã tồn tại)' });
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ success: false, message: 'Không thể thực hiện vì dữ liệu đang được sử dụng ở nơi khác' });
  }
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Lỗi máy chủ, vui lòng thử lại' });
});

module.exports = app;
