import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { formatNumber } from '../utils/format';

/** Hộp thoại dùng chung. Đóng bằng ESC hoặc bấm nền. */
export const Modal = ({ open, onClose, title, icon, children, footer, size = 'md' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className={`relative bg-white dark:bg-[#111a2e] text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 w-full ${width} rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] animate-pop-in`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">{icon}{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 shrink-0 flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  );
};

/** Ô nhập tiền có dấu phân cách hàng nghìn (1.250.000). Giá trị trả ra là số. */
export const MoneyInput = ({ value, onChange, className = 'input', suffix = '₫', ...rest }) => {
  const [text, setText] = useState(value ? formatNumber(value) : '');

  useEffect(() => {
    const current = Number(String(text).replace(/\D/g, '')) || 0;
    if ((Number(value) || 0) !== current) setText(value ? formatNumber(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <input
        {...rest}
        inputMode="numeric"
        className={`${className} pr-9`}
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 13);
          const n = Number(digits) || 0;
          setText(digits ? formatNumber(n) : '');
          onChange?.(n);
        }}
        onFocus={(e) => e.target.select()}
      />
      {suffix && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm pointer-events-none">{suffix}</span>}
    </div>
  );
};

export const Pagination = ({ pagination, onChange }) => {
  if (!pagination || pagination.totalPages <= 1) {
    return pagination?.total ? <p className="text-xs text-slate-400 dark:text-slate-500 mt-4">Tổng {pagination.total} bản ghi</p> : null;
  }
  const { page, totalPages, total } = pagination;
  const pages = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(totalPages, page + 2); p++) pages.push(p);

  return (
    <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
      <p className="text-xs text-slate-400 dark:text-slate-500">Trang {page}/{totalPages} · {total} bản ghi</p>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onChange(page - 1)} className="icon-btn text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
          <ChevronLeft size={18} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${p === page ? 'bg-sky-400 text-white shadow-md shadow-sky-400/25' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            {p}
          </button>
        ))}
        <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} className="icon-btn text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
};

export const EmptyState = ({ icon: Icon = Inbox, title = 'Chưa có dữ liệu', description, action }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center py-14 px-4 animate-fade-in">
    <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800 rounded-3xl flex items-center justify-center mb-4">
      <Icon size={36} className="text-slate-300 dark:text-slate-600" />
    </div>
    <p className="text-base font-semibold text-slate-700 dark:text-slate-200 mb-1">{title}</p>
    {description && <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const PageHeader = ({ icon: Icon, color = 'sky', title, subtitle, actions }) => {
  const colors = {
    sky: 'bg-sky-400 shadow-sky-400/30',
    emerald: 'bg-emerald-500 shadow-emerald-500/30',
    violet: 'bg-violet-500 shadow-violet-500/30',
    amber: 'bg-amber-500 shadow-amber-500/30',
    rose: 'bg-rose-500 shadow-rose-500/30',
    indigo: 'bg-indigo-500 shadow-indigo-500/30'
  };
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className={`w-11 h-11 rounded-2xl ${colors[color]} text-white flex items-center justify-center shadow-lg shrink-0`}>
            <Icon size={22} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
};

/** Hàng skeleton cho bảng khi đang tải. */
export const SkeletonRows = ({ rows = 6, cols = 5 }) => (
  <div className="space-y-3 py-2">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 items-center">
        {Array.from({ length: cols }).map((__, j) => (
          <div key={j} className="skeleton h-9" style={{ flex: j === 1 ? 2 : 1 }} />
        ))}
      </div>
    ))}
  </div>
);

export const SearchInput = ({ value, onChange, placeholder = 'Tìm kiếm...', icon: Icon, className = '' }) => (
  <div className={`relative ${className}`}>
    {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />}
    <input
      type="text"
      className={`input ${Icon ? 'pl-10' : ''}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

/** Hook debounce cho ô tìm kiếm. */
export const useDebounce = (value, delay = 350) => {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
};
