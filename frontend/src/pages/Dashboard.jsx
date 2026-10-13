import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, Package, AlertTriangle, DollarSign, Activity, 
  ShoppingCart, Truck, ArrowRight, Store, ArrowUpRight, CheckCircle2 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { formatCurrency, formatShort, formatDate } from '../utils/format';
import { SkeletonRows } from '../components/ui';

const Dashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/analytics/dashboard');
        setData(res.data.data);
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
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Tổng quan</h1>
        <p className="text-slate-400 dark:text-slate-400 text-sm">Tình hình kinh doanh hiện tại của đại lý</p>
      </div>

      {/* Summary KPI Cards - Exact layout from original design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Doanh thu bán */}
        <div className="card p-6 relative overflow-hidden group hover:shadow-md transition-shadow bg-white dark:bg-[#111a2e]">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-50 dark:bg-emerald-950/20 pointer-events-none" />
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp size={22} />
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 block mb-1">Tổng doanh thu bán</span>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(summary.revenue)}</h3>
        </div>

        {/* Card 2: Chi phí nhập */}
        <div className="card p-6 relative overflow-hidden group hover:shadow-md transition-shadow bg-white dark:bg-[#111a2e]">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-rose-50 dark:bg-rose-950/20 pointer-events-none" />
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
            <DollarSign size={22} />
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 block mb-1">Tổng chi phí nhập</span>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(summary.cost)}</h3>
        </div>

        {/* Card 3: Tổng mặt hàng */}
        <div 
          onClick={() => navigate('/products')}
          className="card p-6 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#111a2e]"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-sky-50 dark:bg-sky-950/20 pointer-events-none" />
          <div className="w-12 h-12 bg-sky-50 dark:bg-sky-950/40 text-sky-400 flex items-center justify-center mb-4">
            <Package size={22} />
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 block mb-1">Tổng mặt hàng</span>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{summary.products} <span className="text-sm font-semibold text-slate-400">sp</span></h3>
        </div>

        {/* Card 4: Cảnh báo tồn kho thấp */}
        <div 
          onClick={() => navigate('/inventory')}
          className="card p-6 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer bg-white dark:bg-[#111a2e]"
        >
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-50 dark:bg-amber-950/20 pointer-events-none" />
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-2xl flex items-center justify-center mb-4">
            <AlertTriangle size={22} />
          </div>
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 block mb-1">Cảnh báo tồn kho thấp</span>
          <h3 className="text-2xl font-black text-amber-500">{summary.lowStock} <span className="text-sm font-semibold text-slate-400">sp</span></h3>
        </div>
      </div>

      {/* Chart & Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Revenue Area Chart */}
        <div className="lg:col-span-2 card p-6 bg-white dark:bg-[#111a2e]">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-400 flex items-center justify-center">
                <Activity size={18} />
              </div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100">Biểu đồ doanh thu 7 ngày qua</h3>
            </div>
            <button onClick={() => navigate('/reports')} className="text-xs text-sky-500 font-bold hover:underline">
              Báo cáo chi tiết →
            </button>
          </div>

          <div className="h-72 w-full">
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
        <div className="card p-6 flex flex-col bg-white dark:bg-[#111a2e]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-base">Đơn hàng mới nhất</h3>
            <button onClick={() => navigate('/sales')} className="text-xs text-sky-500 font-bold hover:underline">
              Tất cả →
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            {(!recentSales || recentSales.length === 0) ? (
              <div className="h-full flex items-center justify-center text-slate-300 dark:text-slate-600 text-xs py-8">
                Chưa có đơn hàng nào
              </div>
            ) : (
              recentSales.map(sale => (
                <div 
                  key={sale.id}
                  onClick={() => navigate('/sales')}
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
