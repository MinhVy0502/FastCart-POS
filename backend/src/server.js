require('dotenv').config();

// Kiểm tra biến môi trường bắt buộc trước khi khởi động
const isProd = process.env.NODE_ENV === 'production';
const required = ['JWT_SECRET', ...(isProd ? ['DATABASE_URL', 'CORS_ORIGIN'] : [])];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
  process.exit(1);
}
if (isProd && process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET quá ngắn (cần ít nhất 32 ký tự) khi chạy production.');
  process.exit(1);
}

const app = require('./app');
const db = require('./models');

const PORT = process.env.PORT || 5000;

db.sequelize.authenticate().then(() => {
  console.log('Database connection has been established successfully.');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Unable to connect to the database:', err);
  // Thoát để nền tảng hosting (Render) tự khởi động lại tiến trình
  process.exit(1);
});
