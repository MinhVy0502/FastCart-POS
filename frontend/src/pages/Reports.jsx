import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, TrendingUp, DollarSign, ShoppingBag, 
  Calendar, Download, ArrowUpRight, ArrowDownRight, 
  Users, Layers, CreditCard, AlertTriangle, RefreshCw 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar 
} from 'recharts';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, SkeletonRows } from '../components/ui';
import { formatCurrency, formatShort, PAYMENT_LABELS, getErrorMessage } from '../utils/format';

const Reports = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Quick preset filter
  const [preset, setPreset] = useState('30days'); // 'today' | '7days' | 'month' | 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const calculateDates = (p) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (p === 'today') {
      const todayStr = fmt(now);
      return { from: todayStr, to: todayStr };
    }
    if (p === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 6);
      return { from: fmt(past), to: fmt(now) };
    }
    if (p === 'month') {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(first), to: fmt(now) };
    }
    if (p === '30days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 29);
      return { from: fmt(past), to: fmt(now) };
    }
    return { from: fromDate, to: toDate };
  };

  const fetchReports = async (from, to) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);

      const res = await api.get(`/analytics/reports?${params.toString()}`);
      setData(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải dữ liệu báo cáo'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { from, to } = calculateDates(preset);
    setFromDate(from);
    setToDate(to);
    fetchReports(from, to);
  }, [preset]);

  const handleApplyCustomFilter = () => {
    if (!fromDate || !toDate) return toast.warning('Vui lòng chọn đủ ngày bắt đầu và kết thúc');
    fetchReports(fromDate, toDate);
  };

  const handleExportExcel = () => {
    if (!data) return toast.warning('Chưa có dữ liệu để xuất');
    const wb = XLSX.utils.book_new();

    // 1. Tổng quan
    const s = data.summary;
    const summarySheet = XLSX.utils.json_to_sheet([
      { 'Chỉ số': 'Tổng doanh thu bán', 'Giá trị': s.revenue },
      { 'Chỉ số': 'Tổng giá vốn (COGS)', 'Giá trị': s.cogs },
      { 'Chỉ số': 'Lợi nhuận gộp', 'Giá trị': s.profit },
      { 'Chỉ số': 'Số đơn hoàn thành', 'Giá trị': s.orders },
      { 'Chỉ số': 'Trung bình/đơn', 'Giá trị': s.avgOrder },
      { 'Chỉ số': 'Tổng giảm giá', 'Giá trị': s.discount },
      { 'Chỉ số': 'Tiền nhập hàng', 'Giá trị': s.purchaseAmount },
      { 'Chỉ số': 'Số đơn đã hủy', 'Giá trị': s.cancelledCount },
      { 'Chỉ số': 'Tiền đơn hủy', 'Giá trị': s.cancelledAmount }
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Tổng quan');

    // 2. Top sản phẩm
    if (data.topProducts?.length) {
      const topSheet = XLSX.utils.json_to_sheet(data.topProducts.map(p => ({
        'Mã SKU': p.sku,
        'Tên sản phẩm': p.name,
        'Số lượng bán': p.quantity,
        'Doanh thu': p.revenue,
        'Lợi nhuận': p.profit,
        'Tồn kho hiện tại': p.currentStock
      })));
      XLSX.utils.book_append_sheet(wb, topSheet, 'Top bán chạy');
    }

    // 3. Top khách hàng
    if (data.topCustomers?.length) {
      const custSheet = XLSX.utils.json_to_sheet(data.topCustomers.map(c => ({
        'Tên khách hàng': c.name,
        'Số điện thoại': c.phone || 'Chưa có',
        'Số đơn': c.orders,
        'Tổng chi tiêu': c.spent
      })));
      XLSX.utils.book_append_sheet(wb, custSheet, 'Khách hàng VIP');
    }

    XLSX.writeFile(wb, `Bao_cao_kinh_doanh_${fromDate}_den_${toDate}.xlsx`);
    toast.success('Đã xuất báo cáo Excel thành công!');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        color="rose"
        title="Báo cáo & Thống kê kinh doanh"
        subtitle="Phân tích doanh thu, giá vốn, lợi nhuận thực tế và hiệu quả bán hàng"
        actions={
          <button onClick={handleExportExcel} className="btn-secondary">
            <Download size={16} /> Xuất file Excel
          </button>
        }
      />

      {/* Date Filter Bar */}
      <div className="card p-4 sm:p-5 flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Preset buttons */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1 w-full md:w-auto overflow-x-auto scrollbar-hide">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: '7days', label: '7 ngày qua' },
            { id: '30days', label: '30 ngày qua' },
            { id: 'month', label: 'Tháng này' },
            { id: 'custom', label: 'Tùy chọn' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                preset === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date inputs */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="date"
            className="input py-1.5 px-3 text-xs flex-1 md:w-36"
            value={fromDate}
            onChange={(e) => { setFromDate(e.target.value); setPreset('custom'); }}
          />
          <span className="text-slate-400 text-xs">đến</span>
          <input
            type="date"
            className="input py-1.5 px-3 text-xs flex-1 md:w-36"
            value={toDate}
            onChange={(e) => { setToDate(e.target.value); setPreset('custom'); }}
          />
          {preset === 'custom' && (
            <button onClick={handleApplyCustomFilter} className="btn-primary py-1.5 px-3 text-xs">
              Lọc
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={8} cols={4} />
      ) : !data ? null : (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Doanh thu */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Doanh thu bán</span>
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <DollarSign size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(data.summary.revenue)}</h3>
              <p className="text-xs text-slate-400 mt-1">{data.summary.orders} đơn hoàn thành</p>
            </div>

            {/* Giá vốn (COGS) */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tiền vốn hàng bán</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <ShoppingBag size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(data.summary.cogs)}</h3>
              <p className="text-xs text-slate-400 mt-1">Giá nhập của các món đã bán</p>
            </div>

            {/* Lợi nhuận gộp */}
            <div className="card p-5 relative overflow-hidden border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Lợi nhuận gộp</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-emerald-600">{formatCurrency(data.summary.profit)}</h3>
              <p className="text-xs text-emerald-600/70 font-semibold mt-1">
                {data.summary.revenue > 0 ? `Tỷ suất: ${Math.round((data.summary.profit / data.summary.revenue) * 100)}%` : '0%'}
              </p>
            </div>

            {/* Trung bình / đơn */}
            <div className="card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Giá trị TB / đơn</span>
                <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                  <CreditCard size={18} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-800">{formatCurrency(data.summary.avgOrder)}</h3>
              <p className="text-xs text-slate-400 mt-1">Chi tiêu trung bình mỗi hóa đơn</p>
            </div>
          </div>

          {/* Revenue & Profit Area Chart */}
          <div className="card p-6">
            <h4 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
              <TrendingUp size={18} className="text-sky-500" /> Biểu đồ Doanh thu & Lợi nhuận
            </h4>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="repRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="repProf" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => formatShort(v)} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <Tooltip 
                    formatter={(val) => formatCurrency(val)} 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px -4px rgb(0 0 0 / 0.15)' }} 
                  />
                  <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#repRev)" />
                  <Area type="monotone" dataKey="profit" name="Lợi nhuận" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#repProf)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 2 Tables: Top Products & Top Customers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Products */}
            <div className="card p-5 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingBag size={17} className="text-emerald-500" /> Top 10 sản phẩm bán chạy nhất
                </span>
                <span className="text-xs text-slate-400 font-normal">Theo số lượng</span>
              </h4>

              {(!data.topProducts || data.topProducts.length === 0) ? (
                <p className="text-xs text-slate-400 py-8 text-center">Chưa có sản phẩm nào được bán trong giai đoạn này.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="py-2">Sản phẩm</th>
                        <th className="py-2 text-center">Đã bán</th>
                        <th className="py-2 text-right">Doanh thu</th>
                        <th className="py-2 text-right">Lãi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.topProducts.map((p, i) => (
                        <tr key={p.id}>
                          <td className="py-2.5">
                            <span className="font-bold text-slate-700">{i + 1}. {p.name}</span>
                            <p className="text-[10px] text-slate-400 font-mono">{p.sku}</p>
                          </td>
                          <td className="py-2.5 text-center font-bold text-emerald-600">{p.quantity}</td>
                          <td className="py-2.5 text-right text-slate-700">{formatCurrency(p.revenue)}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-600">{formatCurrency(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Top Customers */}
            <div className="card p-5 space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users size={17} className="text-sky-500" /> Top 10 khách hàng chi tiêu nhiều nhất
                </span>
                <span className="text-xs text-slate-400 font-normal">VIP</span>
              </h4>

              {(!data.topCustomers || data.topCustomers.length === 0) ? (
                <p className="text-xs text-slate-400 py-8 text-center">Chưa có đơn hàng gắn với khách hàng trong giai đoạn này.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="py-2">Khách hàng</th>
                        <th className="py-2 text-center">Số đơn</th>
                        <th className="py-2 text-right">Tổng chi tiêu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.topCustomers.map((c, i) => (
                        <tr key={c.id}>
                          <td className="py-2.5">
                            <span className="font-bold text-slate-700">{i + 1}. {c.name}</span>
                            <p className="text-[10px] text-slate-400">{c.phone || 'Chưa có SĐT'}</p>
                          </td>
                          <td className="py-2.5 text-center font-bold text-sky-600">{c.orders} đơn</td>
                          <td className="py-2.5 text-right font-extrabold text-slate-800">{formatCurrency(c.spent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
