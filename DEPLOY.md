# 🚀 Hướng dẫn Deploy FastCart POS (Vercel + Render + Neon — Miễn phí)

```
Trình duyệt ──► Vercel (Frontend React) ──► Render (Backend API) ──► Neon (PostgreSQL)
```

Làm **theo đúng thứ tự** bên dưới (Neon → Render → Vercel → quay lại Render).
Đăng nhập cả 3 dịch vụ bằng tài khoản GitHub cho nhanh.

---

## Bước 1 — Tạo Database trên Neon

1. Vào https://neon.tech → **New Project**.
2. **Region**: chọn `AWS Asia Pacific (Singapore)` (gần Việt Nam nhất).
3. Tạo xong, vào **Dashboard → Connect**:
   - **Tắt** tuỳ chọn *Connection pooling*.
   - Copy chuỗi dạng:
     `postgresql://neondb_owner:xxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`
4. Giữ chuỗi này để dán vào Render ở bước 2.

> Không cần tự tạo bảng — backend tự chạy migration mỗi lần khởi động.

---

## Bước 2 — Deploy Backend lên Render

1. Vào https://dashboard.render.com → **New → Blueprint**.
2. Chọn repo `MinhVy0502/FastCart-POS` → Render tự đọc file `render.yaml`.
3. Render hỏi 2 biến:
   | Biến | Giá trị |
   |---|---|
   | `DATABASE_URL` | Chuỗi Neon ở bước 1 |
   | `CORS_ORIGIN` | Tạm điền `https://example.com` (sẽ sửa ở bước 4) |
4. Bấm **Apply** → chờ build xong (~3–5 phút).
5. Mở `https://<tên-service>.onrender.com/health` → thấy `{"status":"ok"}` là thành công.
6. Copy URL backend, ví dụ: `https://fastcart-pos-api.onrender.com`.

> `JWT_SECRET` được Render tự sinh ngẫu nhiên — không cần làm gì.

---

## Bước 3 — Deploy Frontend lên Vercel

1. Vào https://vercel.com/new → Import repo `FastCart-POS`.
2. **Root Directory**: bấm *Edit* → chọn `frontend`.
3. Framework Preset: **Vite** (tự nhận diện).
4. **Environment Variables** → thêm:
   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://fastcart-pos-api.onrender.com/api/v1` |
5. Bấm **Deploy** → nhận URL, ví dụ `https://fastcart-pos.vercel.app`.

---

## Bước 4 — Kết nối Frontend ↔ Backend

1. Quay lại Render → service `fastcart-pos-api` → **Environment**.
2. Sửa `CORS_ORIGIN` = `https://fastcart-pos.vercel.app` (đúng URL Vercel, **không** có `/` ở cuối).
   - Nhiều domain thì cách nhau dấu phẩy: `https://fastcart-pos.vercel.app,https://banhang.com`
3. **Save Changes** → Render tự khởi động lại.
4. Mở URL Vercel → **Đăng ký** tài khoản chủ cửa hàng → dùng thử.

---

## Bước 5 (Rất nên làm) — Chống Render "ngủ"

Render gói free tự tắt sau **15 phút** không có truy cập; lần mở tiếp theo phải chờ **30–50 giây**.

1. Vào https://cron-job.org (miễn phí) → tạo tài khoản → **Create cronjob**.
2. URL: `https://fastcart-pos-api.onrender.com/health`
3. Lịch chạy: **mỗi 10 phút**.

> Gói free có 750 giờ/tháng — đủ để 1 service chạy liên tục cả tháng.

---

## Cập nhật phiên bản mới

Chỉ cần `git push` lên nhánh `main` → Vercel và Render **tự động deploy lại**.

---

## Chuyển dữ liệu đang có ở máy local lên Neon (tuỳ chọn)

```powershell
pg_dump --data-only --no-owner -d dailybanle_dev -U postgres -f data.sql
psql "<chuỗi DATABASE_URL của Neon>" -f data.sql
```
Chỉ chạy **sau khi** backend trên Render đã khởi động thành công ít nhất 1 lần (để bảng được tạo).

---

## Giới hạn của gói miễn phí

| Dịch vụ | Giới hạn |
|---|---|
| Neon | 0.5 GB dữ liệu (đủ cho hàng trăm nghìn hóa đơn) |
| Render | 512 MB RAM, ngủ sau 15 phút nếu không ping |
| Vercel | 100 GB băng thông/tháng |

## Xử lý sự cố

| Triệu chứng | Nguyên nhân / Cách sửa |
|---|---|
| Đăng nhập báo lỗi mạng, Console có chữ `CORS` | `CORS_ORIGIN` trên Render chưa khớp URL Vercel |
| Gọi API báo 404 | `VITE_API_URL` thiếu `/api/v1`, sửa xong phải **Redeploy** Vercel |
| Render log: `Thiếu biến môi trường bắt buộc` | Chưa điền `DATABASE_URL` hoặc `CORS_ORIGIN` |
| Render log: `Unable to connect to the database` | Sai chuỗi Neon hoặc thiếu `?sslmode=require` |
| Lần đầu mở web rất chậm | Render đang "thức dậy" → làm Bước 5 |
