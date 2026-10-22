import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileText, TrendingUp, DollarSign, ShoppingBag, 
  Calendar, Download, ArrowUpRight, ArrowDownRight, 
  Users, Layers, CreditCard, AlertTriangle, RefreshCw,
  Store, Landmark, AlertCircle
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

    // 2. Kênh bán hàng (Bán lẻ vs Bỏ sỉ B2B)
    if (data.channelBreakdown?.length) {
      const channelSheet = XLSX.utils.json_to_sheet(data.channelBreakdown.map(ch => ({
        'Kênh bán hàng': ch.channel === 'WHOLESALE' ? 'Đại lý / Bỏ sỉ (B2B)' : 'Khách mua lẻ (B2C)',
        'Số đơn hàng': ch.orders,
        'Doanh thu': ch.revenue,
        'Lợi nhuận gộp': ch.profit
      })));
      XLSX.utils.book_append_sheet(wb, channelSheet, 'Kênh Bán hàng');
    }

    // 3. Sổ công nợ thị trường & Đại lý
    if (data.debtOverview?.topDebtors?.length) {
      const debtSheet = XLSX.utils.json_to_sheet(data.debtOverview.topDebtors.map(d => ({
        'Tên khách hàng': d.name,
        'Tên tiệm / Cửa hàng': d.storeName || '-',
        'Số điện thoại': d.phone || 'Chưa có',
        'Dư nợ hiện tại': d.currentDebt,
        'Hạn mức nợ': d.debtLimit,
        'Tình trạng': d.debtLimit > 0 && d.currentDebt > d.debtLimit ? 'Vượt hạn mức' : 'Trong hạn mức'
      })));
      XLSX.utils.book_append_sheet(wb, debtSheet, 'Sổ Công nợ Đại lý');
    }

    // 4. Top sản phẩm
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

    // 5. Top khách hàng
    if (data.topCustomers?.length) {
      const custSheet = XLSX.utils.json_to_sheet(data.topCustomers.map(c => ({
        'Tên khách hàng': c.name,
        'Tên tiệm': c.storeName || '-',
        'Số điện thoại': c.phone || 'Chưa có',
        'Số đơn': c.orders,
        'Tổng chi tiêu': c.spent
      })));
      XLSX.utils.book_append_sheet(wb, custSheet, 'Khách hàng VIP');
    }

    XLSX.writeFile(wb, `Bao_cao_kinh_doanh_${fromDate}_den_${toDate}.xlsx`);
    toast.success('Đã xuất báo cáo Excel thành công!');
  };

  const retailChannel = data?.channelBreakdown?.find(c => c.channel === 'RETAIL') || { orders: 0, revenue: 0, profit: 0 };
  const wholesaleChannel = data?.channelBreakdown?.find(c => c.channel === 'WHOLESALE') || { orders: 0, revenue: 0, profit: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        color="rose"
        title="Báo cáo & Thống kê kinh doanh"
        subtitle="Phân tích doanh thu, giá vốn, lợi nhuận bán lẻ & bỏ sỉ đại lý, cùng giám sát công nợ"
        actions={
          <button onClick={handleExportExcel} className="btn-secondary">
            <Download size={16} /> Xuất file Excel
          </button>
        }
      />

      {/* Date Filter Toolbar */}
      <div className="card p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Preset buttons */}
        <div className="flex bg-slate-100 p-1 rounded-2xl w-full md:w-auto overflow-x-auto">
          {[
            { id: 'today', label: 'Hôm nay' },
            { id: '7days', label: '7 ngày qua' },
            { id: '30days', label: '30 ngày qua' },
            { id: 'month', label: 'Tháng này' },
            { id: 'custom', label: 'Tùy chỉnh' }
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPreset(p.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                preset === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date range inputs */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 w-full md:w-auto">
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span className="text-slate-400 text-xs">đến</span>
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
            <button onClick={handleApplyCustomFilter} className="btn-primary py-1.5 px-3 text-xs shrink-0">
              Xem
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonRows rows={6} cols={4} />
      ) : !data ? (
        <div className="card p-12 text-center text-slate-400">Không có dữ liệu báo cáo</div>
      ) : (
        <div className="space-y-6">
          {/* 4 Summary Stat Cards */}
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

          {/* Phân Tách Kênh Bán Hàng: Bán Lẻ vs Bỏ Sỉ Đại Lý (B2B) */}
          <div className="card p-6 space-y-4">
            <h4 className="font-extrabold text-slate-800 text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Store size={19} className="text-indigo-600" /> Phân tích Kênh Bán Hàng: Bán lẻ vs Đại lý bỏ sỉ
              </span>
              <span className="text-xs text-slate-400 font-normal">So sánh hiệu quả theo phân loại khách hàng</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Kênh Bán Lẻ */}
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center font-bold">
                      <Users size={16} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">Kênh Bán Lẻ (B2C)</h5>
                      <p className="text-[11px] text-slate-400">Khách vãng lai, mua trực tiếp</p>
                    </div>
                  </div>
                  <span className="chip bg-sky-100 text-sky-700 font-bold">{retailChannel.orders} đơn</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-sky-100/70">
                  <div>
                    <span className="text-[11px] text-slate-500">Doanh thu bán lẻ:</span>
                    <p className="font-extrabold text-slate-800 text-base mt-0.5">{formatCurrency(retailChannel.revenue)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">Lợi nhuận gộp:</span>
                    <p className="font-extrabold text-sky-600 text-base mt-0.5">{formatCurrency(retailChannel.profit)}</p>
                  </div>
                </div>
              </div>

              {/* Kênh Bỏ Sỉ Đại Lý */}
              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      <Store size={16} />
                    </div>
                    <div>
                      <h5 className="font-bold text-slate-800 text-sm">Kênh Bỏ Sỉ Đại Lý (B2B)</h5>
                      <p className="text-[11px] text-slate-400">Các tiệm tạp hóa, đối tác mua sỉ</p>
                    </div>
                  </div>
                  <span className="chip bg-indigo-100 text-indigo-700 font-bold">{wholesaleChannel.orders} đơn</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-indigo-100/70">
                  <div>
                    <span className="text-[11px] text-slate-500">Doanh thu sỉ:</span>
                    <p className="font-extrabold text-slate-800 text-base mt-0.5">{formatCurrency(wholesaleChannel.revenue)}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">Lợi nhuận gộp:</span>
                    <p className="font-extrabold text-indigo-600 text-base mt-0.5">{formatCurrency(wholesaleChannel.profit)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quản Trị Công Nợ Toàn Hệ Thống (B2B Debt Management) */}
          <div className="card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Landmark size={19} className="text-rose-500" /> Quản Trị & Giám Sát Công Nợ Thị Trường
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">Theo dõi số nợ gối đầu của các tiệm tạp hóa và đại lý cấp dưới</p>
              </div>
            </div>

            {/* 3 Metric Cards for Debt */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-rose-50/70 border border-rose-100 rounded-2xl">
                <span className="text-xs font-semibold text-rose-600">Tổng công nợ thị trường</span>
                <h4 className="text-2xl font-black text-rose-700 mt-1">
                  {formatCurrency(data.debtOverview?.totalDebt || 0)}
                </h4>
                <p className="text-[11px] text-rose-500 mt-0.5">Chưa thu hồi từ các khách hàng</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-xs font-semibold text-slate-500">Số đại lý / khách đang nợ</span>
                <h4 className="text-2xl font-black text-slate-800 mt-1">
                  {data.debtOverview?.indebtedCount || 0} tiệm
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Đang có dư nợ {'>'} 0</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                <span className="text-xs font-semibold text-slate-500">Tổng hạn mức nợ cấp phép</span>
                <h4 className="text-2xl font-black text-slate-800 mt-1">
                  {formatCurrency(data.debtOverview?.totalLimit || 0)}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Tổng định mức nợ an toàn</p>
              </div>
            </div>

            {/* Top Debtors Table */}
            {(!data.debtOverview?.topDebtors || data.debtOverview.topDebtors.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">Tuyệt vời! Hiện không có đại lý nào có nợ xấu hoặc nợ đọng.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[11px]">
                      <th className="py-2.5">Tên tiệm / Đại lý</th>
                      <th className="py-2.5">Người đại diện & SĐT</th>
                      <th className="py-2.5">Phân loại</th>
                      <th className="py-2.5 text-right">Hạn mức</th>
                      <th className="py-2.5 text-right">Dư nợ hiện tại</th>
                      <th className="py-2.5 text-center">Tình trạng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.debtOverview.topDebtors.map((d) => {
                      const isExceeded = Number(d.debtLimit) > 0 && Number(d.currentDebt) > Number(d.debtLimit);
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 font-bold text-slate-800">
                            {d.storeName || d.name}
                          </td>
                          <td className="py-2.5 text-slate-600">
                            <span>{d.name}</span>
                            {d.phone && <span className="text-slate-400 ml-1.5 font-mono">({d.phone})</span>}
                          </td>
                          <td className="py-2.5">
                            {d.customerType === 'WHOLESALE' ? (
                              <span className="chip bg-indigo-50 text-indigo-600 font-bold">Đại lý</span>
                            ) : (
                              <span className="chip bg-slate-100 text-slate-600">Khách lẻ</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right text-slate-500 font-medium">
                            {Number(d.debtLimit) > 0 ? formatCurrency(d.debtLimit) : 'Không giới hạn'}
                          </td>
                          <td className="py-2.5 text-right font-black text-rose-600 text-sm">
                            {formatCurrency(d.currentDebt)}
                          </td>
                          <td className="py-2.5 text-center">
                            {isExceeded ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700">
                                <AlertTriangle size={11} /> Vượt hạn mức
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-600">
                                An toàn
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                  <Users size={17} className="text-sky-500" /> Top 10 khách hàng & đại lý lớn nhất
                </span>
                <span className="text-xs text-slate-400 font-normal">VIP / Đối tác</span>
              </h4>

              {(!data.topCustomers || data.topCustomers.length === 0) ? (
                <p className="text-xs text-slate-400 py-8 text-center">Chưa có đơn hàng gắn với khách hàng trong giai đoạn này.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400">
                        <th className="py-2">Khách hàng / Tiệm</th>
                        <th className="py-2 text-center">Số đơn</th>
                        <th className="py-2 text-right">Tổng chi tiêu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {data.topCustomers.map((c, i) => (
                        <tr key={c.id}>
                          <td className="py-2.5">
                            <span className="font-bold text-slate-700">
                              {i + 1}. {c.storeName ? `${c.storeName} (${c.name})` : c.name}
                            </span>
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
