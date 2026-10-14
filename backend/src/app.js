const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const app = express();
const isProd = process.env.NODE_ENV === 'production';

// Render / Vercel đứng sau proxy → cần để rate-limit lấy đúng IP người dùng
app.set('trust proxy', 1);

// CORS: chỉ cho phép các domain khai báo trong CORS_ORIGIN (phân tách bằng dấu phẩy)
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Cho phép request không có Origin (health check, curl, app di động)
    if (!origin) return callback(null, true);
    // Môi trường dev: cho phép mọi origin (localhost, IP LAN)
    if (!isProd) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS: Origin không được phép'));
  }
}));

app.use(helmet());
app.use(morgan(isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to DailyBanLe API' });
});

// Dùng cho Render health check và dịch vụ ping giữ server không "ngủ"
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

// Chống dò mật khẩu: tối đa 10 lần đăng nhập / 15 phút / IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.' }
});
app.use('/api/v1/auth/login', loginLimiter);
app.use('/api/v1/auth/register', loginLimiter);

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

app.use((err, req, res, next) => {
  // Lỗi nghiệp vụ (AppError) → trả nguyên thông báo
  if (err.isAppError) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  if (err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ success: false, message: err.message });
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
