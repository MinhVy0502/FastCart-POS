import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Package, AlertTriangle, DollarSign, Activity, 
  ShoppingCart, Truck, ArrowRight, Store, ArrowUpRight, CheckCircle2,
  Clock, Users, BarChart3, Warehouse
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { formatCurrency, formatShort, formatDate } from '../utils/format';
import { SkeletonRows } from '../components/ui';

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [expiringSummary, setExpiringSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, expRes] = await Promise.all([
          api.get('/analytics/dashboard'),
          api.get('/products/expiring?days=30').catch(() => ({ data: { summary: null } }))
        ]);
        setData(dashRes.data.data);
        setExpiringSummary(expRes.data?.summary || null);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonRows rows={4} cols={4} />
      </div>
    );
  }

  if (!data) return null;

  const { summary, today, month, recentSales, chartData, topProducts } = data;

  return (
    <div className="space-y-5">
      {/* Title & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tổng quan cửa hàng</h1>
          <p className="text-slate-400 dark:text-slate-400 text-xs sm:text-sm">Kết quả bán lẻ & bán sỉ hôm nay, công nợ và cảnh báo tồn kho</p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => navigate('/sales?mode=pos')}
            className="btn-success py-2 px-3.5 text-xs rounded-2xl shrink-0"
          >
            <ShoppingCart size={15} /> Bán hàng (POS)
          </button>
          <button
            onClick={() => navigate('/customers?filter=DEBT')}
            className="btn-secondary py-2 px-3 text-xs rounded-2xl shrink-0 text-rose-600 border-rose-200 bg-rose-50/50"
          >
            <Users size={15} /> Sổ nợ khách
          </button>
          <button
            onClick={() => navigate('/inventory')}
            className="btn-secondary py-2 px-3 text-xs rounded-2xl shrink-0"
          >
            <Warehouse size={15} className="text-amber-500" /> Kiểm kho
          </button>
          <button
            onClick={() => navigate('/reports')}
            className="btn-secondary py-2 px-3 text-xs rounded-2xl shrink-0"
          >
            <BarChart3 size={15} className="text-indigo-500" /> Báo cáo lãi lỗ
          </button>
        </div>
      </div>

      {/* Owner-Focused KPI Cards (2x2 on Mobile, 4 cols on Desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Card 1: Doanh thu hôm nay */}
        <div
          onClick={() => navigate('/sales?mode=list')}
          className="card p-4 sm:p-6 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#111a2e]"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-950/20 pointer-events-none" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-2xl flex items-center justify-center mb-3">
            <TrendingUp size={20} />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Doanh thu hôm nay</span>
          <h3 className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(today?.revenue || 0)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            <b>{today?.orders || 0}</b> đơn hôm nay · Tháng: {formatShort(month?.revenue || 0)}
          </p>
        </div>

        {/* Card 2: Lợi nhuận gộp hôm nay */}
        <div
          onClick={() => navigate('/reports')}
          className="card p-4 sm:p-6 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#111a2e]"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-sky-50 dark:bg-sky-950/20 pointer-events-none" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-sky-50 dark:bg-sky-950/40 text-sky-500 rounded-2xl flex items-center justify-center mb-3">
            <DollarSign size={20} />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Lãi gộp hôm nay</span>
          <h3 className="text-lg sm:text-2xl font-black text-sky-600 dark:text-sky-400">
            {formatCurrency(today?.profit || 0)}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Lãi tháng này: <b>{formatShort(month?.profit || 0)}</b>
          </p>
        </div>

        {/* Card 3: Tổng nợ khách cần thu */}
        <div 
          onClick={() => navigate('/customers?filter=DEBT')}
          className="card p-4 sm:p-6 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#111a2e]"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-950/20 pointer-events-none" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center mb-3">
            <Users size={20} />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Tổng nợ khách cần thu</span>
          <h3 className="text-lg sm:text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatCurrency(summary?.totalDebt || 0)}
          </h3>
          <p className="text-[11px] text-rose-500 font-semibold mt-1 flex items-center gap-0.5">
            <span>Mở sổ thu nợ</span> <ArrowRight size={11} />
          </p>
        </div>

        {/* Card 4: Cảnh báo tồn kho thấp */}
        <div 
          onClick={() => navigate('/inventory')}
          className="card p-4 sm:p-6 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#111a2e]"
        >
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/20 pointer-events-none" />
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-2xl flex items-center justify-center mb-3">
            <AlertTriangle size={20} />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold text-slate-400 block mb-0.5">Sắp hết hàng</span>
          <h3 className="text-lg sm:text-2xl font-black text-amber-500">
            {summary.lowStock} <span className="text-xs sm:text-sm font-semibold text-slate-400">/ {summary.products} SP</span>
          </h3>
          <p className="text-[11px] text-amber-600 font-semibold mt-1 flex items-center gap-0.5">
            <span>Kiểm tra & Nhập thêm</span> <ArrowRight size={11} />
          </p>
        </div>
      </div>

      {/* Expiry Warning Alert Banner */}
      {expiringSummary?.totalExpiring > 0 && (
        <div 
          onClick={() => navigate('/inventory?tab=expiring')}
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-4 cursor-pointer hover:bg-amber-500/15 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/30">
              <Clock size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                <span>Cảnh báo: Có {expiringSummary.totalExpiring} lô hàng cận hạn sử dụng</span>
                {expiringSummary.expiredCount > 0 && (
                  <span className="text-[10px] font-extrabold text-white bg-rose-500 px-2 py-0.5 rounded-full">
                    {expiringSummary.expiredCount} lô đã hết hạn!
                  </span>
                )}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Các mặt hàng này cần được ưu tiên bán trước (FEFO) hoặc thanh lý để tránh tổn thất tồn đọng.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0">
            <span>Kiểm tra kho</span>
            <ArrowRight size={14} />
          </div>
        </div>
      )}

      {/* Chart & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Revenue Area Chart */}
        <div className="lg:col-span-2 card p-4 sm:p-6 bg-white dark:bg-[#111a2e]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-400 flex items-center justify-center">
                <Activity size={18} />
              </div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base">Doanh thu 7 ngày qua</h3>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs text-sky-500 font-bold hover:underline">
              Báo cáo chi tiết →
            </button>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(val) => formatShort(val)} />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" className="dark:opacity-10" />
                <Tooltip 
                  formatter={(val) => formatCurrency(val)} 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 8px 24px -4px rgb(0 0 0 / 0.15)' }} 
                />
                <Area type="monotone" dataKey="revenue" name="Doanh thu" stroke="#38bdf8" strokeWidth={3} fillOpacity={1} fill="url(#dashRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Sales List */}
        <div className="card p-4 sm:p-6 flex flex-col bg-white dark:bg-[#111a2e]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">Đơn hàng mới nhất</h3>
            <button onClick={() => navigate('/sales?mode=list')} className="text-xs text-sky-500 font-bold hover:underline">
              Lịch sử đơn →
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5">
            {(!recentSales || recentSales.length === 0) ? (
              <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs py-8">
                Chưa có đơn hàng nào
              </div>
            ) : (
              recentSales.map(sale => (
                <div 
                  key={sale.id}
                  onClick={() => navigate('/sales?mode=list')}
                  className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100/70 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                >
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-mono">{sale.code}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{sale.customer?.name || 'Khách lẻ'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-500 text-xs sm:text-sm">{formatCurrency(sale.finalAmount)}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(sale.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
