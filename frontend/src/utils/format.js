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

export const PAYMENT_LABELS = { CASH: 'Tiền mặt', TRANSFER: 'Chuyển khoản' };
