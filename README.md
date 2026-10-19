# 🛒 FastCart POS - Hệ Thống Quản Lý Bán Lẻ & Kho Hàng Thông Minh

FastCart POS là giải pháp phần mềm quản lý bán hàng và kho hàng hiện đại, tối ưu cho các cửa hàng bán lẻ, tạp hóa, siêu thị mini và đại lý phân phối. Hệ thống được thiết kế với giao diện thân thiện, hỗ trợ đầy đủ chế độ Sáng / Tối (Light & Dark Mode), tích hợp máy quét mã vạch và thanh toán mã VietQR tự động.

---

## ✨ Tính Năng Nổi Bật

### 1. Quầy Thu Ngân (POS) Hiện Đại
- Giao diện bán hàng nhanh, phím tắt tiện lợi (`F2` tìm kiếm, `F9` thanh toán).
- Hỗ trợ máy quét mã vạch vật lý và **Camera Scanner** quét trực tiếp bằng camera điện thoại/laptop.
- Tự động gợi ý tiền khách đưa và tính tiền thối lại chính xác.
- Tạo mã thanh toán ngân hàng **VietQR động** chuẩn Napas247 hiển thị ngay trên màn hình.
- In hóa đơn bán hàng trực tiếp ra máy in nhiệt (khổ K80, K57).

### 2. Quản Lý Sản Phẩm & Tem Nhãn Mã Vạch
- Quản lý mã SKU, mã vạch, tên hàng hóa, giá vốn, giá bán và tỷ suất lợi nhuận.
- Cảnh báo sản phẩm sắp hết hàng (dưới mức tồn kho tối thiểu).
- **In tem nhãn mã vạch**: Hỗ trợ in tem hàng loạt theo khổ giấy A4 (nhiều tem) hoặc máy in mã vạch decal cuộn.
- Nhập & Xuất danh sách sản phẩm nhanh chóng qua file **Excel (.xlsx)**.

### 3. Quản Lý Kệ Hàng & Vị Trí Lưu Trữ
- Định vị vị trí hàng hóa trong cửa hàng theo từng dãy/kệ (VD: *Kệ A1 - Gia vị*, *Kệ B2 - Đồ khô*).
- Xem danh sách sản phẩm trên từng kệ hàng.
- Hiển thị nhãn vị trí kệ trực tiếp trên thẻ sản phẩm ở quầy thu ngân (giúp nhân viên tìm đồ ngay khi khách hỏi).

### 4. Quản Lý Kho & Nhập Hàng
- Quản lý lịch sử giao dịch kho (Nhập hàng, Bán hàng, Điều chỉnh kiểm kê).
- Tạo đơn nhập hàng từ Nhà cung cấp, theo dõi công nợ nhà cung cấp.

### 5. Khách Hàng & Đối Tác
- Quản lý danh bạ khách hàng thân thiết, lịch sử mua hàng và công nợ.
- Quản lý danh bạ nhà cung cấp hàng hóa.

### 6. Báo Cáo & Thống Kê Doanh Thu
- Biểu đồ trực quan doanh thu, lợi nhuận gộp theo ngày/tuần/tháng.
- Thống kê mặt hàng bán chạy nhất và sản phẩm cần nhập thêm.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

* **Frontend**:
  * [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
  * [Tailwind CSS v4](https://tailwindcss.com/)
  * [Lucide React](https://lucide.dev/) (Bộ icon hiện đại)
  * [Recharts](https://recharts.org/) (Biểu đồ doanh thu)
  * [html5-qrcode](https://github.com/mebjas/html5-qrcode) & [JsBarcode](https://lindell.me/JsBarcode/)
  * [SheetJS (xlsx)](https://sheetjs.com/) (Xử lý file Excel)

* **Backend**:
  * [Node.js](https://nodejs.org/) & [Express 5](https://expressjs.com/)
  * [Sequelize ORM](https://sequelize.org/)
  * [PostgreSQL](https://www.postgresql.org/)
  * JWT Authentication & Bcrypt (Bảo mật tài khoản đa người dùng)

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy

### 1. Yêu cầu môi trường
- **Node.js** (phiên bản 18+ hoặc 20+)
- **PostgreSQL** (phiên bản 14+)

### 2. Cài đặt Dependencies

```bash
# Cài đặt backend
cd backend
npm install

# Cài đặt frontend
cd ../frontend
npm install
```

### 3. Cấu hình Cơ sở dữ liệu

Tạo file `backend/.env` từ file mẫu `backend/.env.example`:

```env
PORT=5000
DATABASE_URL=postgres://postgres:password@127.0.0.1:5432/dailybanle_dev
DB_USERNAME=postgres
DB_PASSWORD=password
DB_NAME=dailybanle_dev
DB_HOST=127.0.0.1
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
VITE_API_URL=http://localhost:5000/api/v1
```

Chạy migration để khởi tạo cấu trúc bảng:

```bash
cd backend
npx sequelize-cli db:migrate
```

### 4. Khởi chạy ứng dụng

* **Cách 1 (Khuyên dùng trên Windows)**: Nhấp đúp vào file `start.bat` ở thư mục gốc.
* **Cách 2 (Khởi chạy thủ công)**:
  ```bash
  # Terminal 1 - Backend:
  cd backend
  npx nodemon src/server.js

  # Terminal 2 - Frontend:
  cd frontend
  npm run dev
  ```

Truy cập hệ thống tại: `https://fast-cart-pos.vercel.app/`

---

## 📄 Bản Quyền
Dự án được xây dựng và phát triển phục vụ công tác quản lý bán lẻ và chuyển đổi số cho cửa hàng.
