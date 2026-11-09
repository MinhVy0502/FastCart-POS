export const formatCurrency = (val) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(Number(val) || 0);

export const formatNumber = (val) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(val) || 0);

/** Rút gọn: 1.250.000 → 1,25tr ; 15.000 → 15k */
export const formatShort = (val) => {
  const n = Number(val) || 0;
  if (Math.abs(n) >= 1e9) return `${+(n / 1e9).toFixed(2)}tỷ`;
  if (Math.abs(n) >= 1e6) return `${+(n / 1e6).toFixed(2)}tr`;
  if (Math.abs(n) >= 1e3) return `${+(n / 1e3).toFixed(0)}k`;
  return String(n);
};

export const formatDate = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour12: false }) : '');
export const formatDay = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');

const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const getErrorMessage = (err, fallback = 'Có lỗi xảy ra') =>
  err?.response?.data?.message || (err?.message === 'Network Error' ? 'Không kết nối được máy chủ' : fallback);

export const PAYMENT_LABELS = { CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản', DEBT: 'Ghi nợ' };

/**
 * Hiển thị quy đổi tồn kho trực quan theo quy cách đóng gói lớn nhất khả dụng.
 * VD: currentStock = 52, baseUnit = 'Lon', units = [{ unitName: 'Thùng', conversionFactor: 24 }]
 * => "2 Thùng + 4 Lon"
 */
export const formatStockBreakdown = (currentStock, baseUnit = 'Cái', units = []) => {
  const stock = Number(currentStock) || 0;
  if (stock <= 0 || !Array.isArray(units) || units.length === 0) return null;

  const sorted = [...units]
    .filter((u) => u && u.unitName && Number(u.conversionFactor) > 1)
    .sort((a, b) => Number(b.conversionFactor) - Number(a.conversionFactor));

  if (sorted.length === 0) return null;

  const targetUnit = sorted.find((u) => stock >= Number(u.conversionFactor));
  if (!targetUnit) return null;

  const factor = Number(targetUnit.conversionFactor);
  const whole = Math.floor(stock / factor);
  const remainder = stock % factor;
  const bUnit = baseUnit || 'Cái';

  return remainder > 0
    ? `${whole} ${targetUnit.unitName} + ${remainder} ${bUnit}`
    : `${whole} ${targetUnit.unitName}`;
};

