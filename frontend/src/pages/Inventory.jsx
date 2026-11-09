import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Archive, ArrowDownRight, ArrowUpRight, RefreshCw, AlertCircle, 
  Search, SlidersHorizontal, Plus, Calendar, FileSpreadsheet, CheckCircle2,
  Clock, ShoppingCart, AlertTriangle, ArrowRight, MapPin
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatDate, formatStockBreakdown, getErrorMessage } from '../utils/format';

const Inventory = () => {
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('stock'); // 'stock' | 'history' | 'expiring'

  // Tab 1: Current Stock State
  const [products, setProducts] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState('');
  const [stockLowOnly, setStockLowOnly] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [stockPagination, setStockPagination] = useState(null);

  // Tab 2: Transaction History State
  const [transactions, setTransactions] = useState([]);
  const [transLoading, setTransLoading] = useState(true);
  const [transType, setTransType] = useState('');
  const [transFrom, setTransFrom] = useState('');
  const [transTo, setTransTo] = useState('');
  const [transPage, setTransPage] = useState(1);
  const [transPagination, setTransPagination] = useState(null);

  // Tab 3: Expiring Batches State
  const [expiringBatches, setExpiringBatches] = useState([]);
  const [expiringLoading, setExpiringLoading] = useState(false);
  const [expiringDays, setExpiringDays] = useState(30);
  const [expiringSummary, setExpiringSummary] = useState(null);

  // Stock Adjustment (Kiểm kê) Modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [actualStock, setActualStock] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBatchId, setAdjustBatchId] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);

  const fetchStock = async () => {
    try {
      setStockLoading(true);
      const params = new URLSearchParams({ page: String(stockPage), limit: '15' });
      if (stockSearch.trim()) params.append('search', stockSearch.trim());
      if (stockLowOnly) params.append('lowStock', 'true');

      const res = await api.get(`/products?${params.toString()}`);
      setProducts(res.data.data || []);
      setStockPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải tồn kho'));
    } finally {
      setStockLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setTransLoading(true);
      const params = new URLSearchParams({ page: String(transPage), limit: '20' });
      if (transType) params.append('type', transType);
      if (transFrom) params.append('from', transFrom);
      if (transTo) params.append('to', transTo);

      const res = await api.get(`/inventory/transactions?${params.toString()}`);
      setTransactions(res.data.data || []);
      setTransPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải lịch sử biến động'));
    } finally {
      setTransLoading(false);
    }
  };

  const fetchExpiringBatches = async () => {
    try {
      setExpiringLoading(true);
      const res = await api.get(`/products/expiring?days=${expiringDays}`);
      setExpiringBatches(res.data.data || []);
      setExpiringSummary(res.data.summary || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách hàng cận date'));
    } finally {
      setExpiringLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'expiring') {
      setTab('expiring');
    }
    // Fetch summary on load to show badge
    api.get('/products/expiring?days=30')
      .then(res => setExpiringSummary(res.data.summary || null))
      .catch(() => {});
  }, [location.search]);

  useEffect(() => {
    if (tab === 'stock') {
      const timer = setTimeout(fetchStock, 300);
      return () => clearTimeout(timer);
    }
  }, [tab, stockPage, stockSearch, stockLowOnly]);

  useEffect(() => {
    if (tab === 'history') {
      fetchTransactions();
    }
  }, [tab, transPage, transType, transFrom, transTo]);

  useEffect(() => {
    if (tab === 'expiring') {
      fetchExpiringBatches();
    }
  }, [tab, expiringDays]);

  const handleOpenAdjust = (p) => {
    setAdjustProduct(p);
    setActualStock(p.currentStock);
    setAdjustReason('');
    setAdjustBatchId('');
    setAdjustOpen(true);
  };

  const handleSaveAdjust = async (e) => {
    e.preventDefault();
    if (!adjustReason.trim()) return toast.warning('Vui lòng nhập lý do kiểm kê điều chỉnh');
    try {
      setAdjustSaving(true);
      await api.post('/inventory/adjust', {
        productId: adjustProduct.id,
        actualStock: Number(actualStock),
        reason: adjustReason.trim(),
        batchId: adjustBatchId || null
      });
      toast.success('Đã cập nhật số lượng tồn kho thực tế!');
      setAdjustOpen(false);
      fetchStock();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Điều chỉnh thất bại'));
    } finally {
      setAdjustSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Archive}
        color="amber"
        title="Quản lý kho hàng"
        subtitle="Kiểm kê tồn kho, điều chỉnh số lượng thực tế và theo dõi thẻ kho chi tiết"
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {/* Navigation Tabs */}
        <div className="flex justify-between items-center flex-wrap gap-3 pb-2 border-b border-slate-100">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setTab('stock')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                tab === 'stock' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tồn kho hiện tại
            </button>
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
                tab === 'history' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Thẻ kho (Lịch sử xuất nhập)
            </button>
            <button
              onClick={() => setTab('expiring')}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                tab === 'expiring' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Clock size={15} />
              Cảnh báo HSD
              {expiringSummary?.totalExpiring > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${tab === 'expiring' ? 'bg-white text-amber-600' : 'bg-amber-100 text-amber-700'}`}>
                  {expiringSummary.totalExpiring}
                </span>
              )}
            </button>
          </div>

          {tab === 'stock' && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-rose-500 focus:ring-rose-400 w-4 h-4"
                checked={stockLowOnly}
                onChange={(e) => { setStockLowOnly(e.target.checked); setStockPage(1); }}
              />
              <span className="text-rose-600 font-bold">Chỉ hiện sản phẩm sắp hết hàng</span>
            </label>
          )}
        </div>

        {/* TAB 1: CURRENT STOCK */}
        {tab === 'stock' && (
          <div className="space-y-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                type="text"
                placeholder="Tìm sản phẩm theo tên, SKU, mã vạch..."
                className="input pl-10"
                value={stockSearch}
                onChange={(e) => { setStockSearch(e.target.value); setStockPage(1); }}
              />
            </div>

            {stockLoading ? (
              <SkeletonRows rows={6} cols={5} />
            ) : products.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="Không có sản phẩm nào phù hợp"
                description="Thử thay đổi bộ lọc tìm kiếm hoặc thêm sản phẩm mới vào hệ thống."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="th">Mã SKU & Barcode</th>
                      <th className="th">Sản phẩm</th>
                      <th className="th text-center">Tối thiểu</th>
                      <th className="th text-center">Tồn kho hiện tại</th>
                      <th className="th">Tình trạng</th>
                      <th className="th text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {products.map((p) => {
                      const isLow = p.currentStock <= p.minStock;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="td">
                            <div className="font-mono font-bold text-slate-600">{p.sku}</div>
                            {p.barcode && <div className="font-mono text-[11px] text-slate-400">{p.barcode}</div>}
                          </td>
                          <td className="td">
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.category?.name || 'Không có danh mục'}</p>
                          </td>
                          <td className="td text-center text-slate-500">{p.minStock} {p.unit || 'Cái'}</td>
                          <td className="td text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className={`text-base font-extrabold ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {p.currentStock} {p.unit || 'Cái'}
                              </span>
                              {formatStockBreakdown(p.currentStock, p.unit, p.units) && (
                                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50/80 dark:bg-sky-950/40 px-1.5 py-0.2 rounded">
                                  ≈ {formatStockBreakdown(p.currentStock, p.unit, p.units)}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="td">
                            {isLow ? (
                              <span className="chip bg-rose-50 text-rose-600 font-bold">
                                <AlertCircle size={13} /> Sắp hết hàng
                              </span>
                            ) : (
                              <span className="chip bg-emerald-50 text-emerald-600 font-bold">
                                An toàn
                              </span>
                            )}
                          </td>
                          <td className="td text-right">
                            <button
                              onClick={() => handleOpenAdjust(p)}
                              className="btn-secondary py-1.5 px-3 text-xs font-bold text-amber-600 hover:text-amber-700"
                              title="Kiểm kê / Điều chỉnh tồn kho thực tế"
                            >
                              <SlidersHorizontal size={14} /> Kiểm kê
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination pagination={stockPagination} onChange={setStockPage} />
          </div>
        )}

        {/* TAB 2: TRANSACTION HISTORY (THẺ KHO) */}
        {tab === 'history' && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <select
                  className="input"
                  value={transType}
                  onChange={(e) => { setTransType(e.target.value); setTransPage(1); }}
                >
                  <option value="">Tất cả loại giao dịch</option>
                  <option value="IN">Nhập kho (+)</option>
                  <option value="OUT">Xuất kho / Bán hàng (-)</option>
                  <option value="ADJUST">Kiểm kê điều chỉnh</option>
                </select>
              </div>

              <div>
                <input
                  type="date"
                  className="input"
                  value={transFrom}
                  onChange={(e) => { setTransFrom(e.target.value); setTransPage(1); }}
                />
              </div>

              <div>
                <input
                  type="date"
                  className="input"
                  value={transTo}
                  onChange={(e) => { setTransTo(e.target.value); setTransPage(1); }}
                />
              </div>
            </div>

            {transLoading ? (
              <SkeletonRows rows={6} cols={6} />
            ) : transactions.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="Chưa có lịch sử xuất nhập kho nào"
                description="Khi tạo phiếu nhập, hóa đơn bán hoặc kiểm kê, lịch sử thẻ kho sẽ được lưu lại tại đây."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[760px]">
                  <thead>
                    <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                      <th className="th">Thời gian</th>
                      <th className="th">Loại biến động</th>
                      <th className="th">Sản phẩm</th>
                      <th className="th text-center">Số lượng</th>
                      <th className="th">Mã tham chiếu</th>
                      <th className="th">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="td text-slate-500 text-xs">{formatDate(t.createdAt)}</td>
                        <td className="td">
                          {t.type === 'IN' ? (
                            <span className="chip bg-emerald-50 text-emerald-600 font-bold">
                              <ArrowDownRight size={13} /> Nhập kho
                            </span>
                          ) : t.type === 'OUT' ? (
                            <span className="chip bg-rose-50 text-rose-600 font-bold">
                              <ArrowUpRight size={13} /> Xuất bán
                            </span>
                          ) : (
                            <span className="chip bg-sky-50 text-sky-600 font-bold">
                              <RefreshCw size={13} /> Kiểm kê
                            </span>
                          )}
                        </td>
                        <td className="td">
                          <p className="font-bold text-slate-800">{t.product?.name}</p>
                          <p className="text-xs text-slate-400 font-mono">
                            {t.product?.sku}
                            {t.product?.barcode && <span className="ml-1 text-sky-500">· {t.product.barcode}</span>}
                          </p>
                        </td>
                        <td className="td text-center">
                          <span className={`font-extrabold text-sm ${
                            t.type === 'IN' || (t.type === 'ADJUST' && t.quantity > 0)
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}>
                            {t.quantity > 0 ? `+${t.quantity}` : t.quantity} {t.product?.unit || 'Cái'}
                          </span>
                        </td>
                        <td className="td font-mono text-xs text-slate-600 font-semibold">{t.referenceCode || '-'}</td>
                        <td className="td text-slate-500 text-xs max-w-xs truncate" title={t.note}>{t.note || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination pagination={transPagination} onChange={setTransPage} />
          </div>
        )}

        {/* TAB 3: CẢNH BÁO HẠN SỬ DỤNG (EXPIRING BATCHES) */}
        {tab === 'expiring' && (
          <div className="space-y-4">
            {/* Filter toolbar & summary stats */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Xem các lô hết hạn trong:</span>
                {[15, 30, 60, 90].map(days => (
                  <button
                    key={days}
                    onClick={() => setExpiringDays(days)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                      expiringDays === days
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {days} ngày
                  </button>
                ))}
              </div>

              {/* KPI Badges */}
              <div className="flex items-center gap-2">
                <span className="chip font-bold text-xs bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                  Đã hết hạn: {expiringSummary?.expiredCount || 0} lô
                </span>
                <span className="chip font-bold text-xs bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                  Cận date: {expiringSummary?.nearExpiryCount || 0} lô
                </span>
              </div>
            </div>

            {/* Expiring Batches Table */}
            {expiringLoading ? (
              <SkeletonRows rows={6} cols={7} />
            ) : expiringBatches.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Không có lô hàng nào sắp hết hạn"
                description={`Tất cả các lô hàng hiện tại đều có hạn sử dụng an toàn trên ${expiringDays} ngày.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[850px]">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                      <th className="th">Sản phẩm & Barcode</th>
                      <th className="th">Vị trí kệ</th>
                      <th className="th">Số lô (Batch)</th>
                      <th className="th">Ngày SX</th>
                      <th className="th">Hạn sử dụng</th>
                      <th className="th text-right">Tồn lô hiện tại</th>
                      <th className="th text-center">Trạng thái</th>
                      <th className="th text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {expiringBatches.map((b) => {
                      const p = b.product || {};
                      const isExpired = b.daysLeft <= 0;
                      const isUrgent = b.daysLeft > 0 && b.daysLeft <= 15;

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="td">
                            <p className="font-bold text-slate-800 dark:text-slate-100">{p.name || '-'}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              {p.sku}
                              {p.barcode && <span className="ml-1 text-sky-500">· {p.barcode}</span>}
                            </p>
                          </td>
                          <td className="td">
                            {p.shelf ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                                <MapPin size={10} className="shrink-0" />
                                {p.shelf.code ? `[${p.shelf.code}] ` : ''}{p.shelf.name}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400 italic">Chưa xếp kệ</span>
                            )}
                          </td>
                          <td className="td font-mono font-bold text-slate-700 dark:text-slate-300 text-xs">
                            {b.batchNumber}
                          </td>
                          <td className="td text-slate-500 text-xs whitespace-nowrap">
                            {b.manufacturingDate ? formatDate(b.manufacturingDate) : '-'}
                          </td>
                          <td className="td font-bold text-slate-800 dark:text-slate-200 text-xs whitespace-nowrap">
                            {formatDate(b.expiryDate)}
                          </td>
                          <td className="td text-right font-extrabold whitespace-nowrap">
                            <span className="text-amber-600 dark:text-amber-400">{b.currentQuantity}</span>
                            <span className="text-slate-400 font-normal text-xs"> {p.unit || 'Cái'}</span>
                          </td>
                          <td className="td text-center whitespace-nowrap">
                            {isExpired ? (
                              <span className="chip font-bold text-[10px] bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                Đã hết hạn ({Math.abs(b.daysLeft)} ngày trước)
                              </span>
                            ) : isUrgent ? (
                              <span className="chip font-bold text-[10px] bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                Cấp bách (Còn {b.daysLeft} ngày)
                              </span>
                            ) : (
                              <span className="chip font-bold text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                                Cận date (Còn {b.daysLeft} ngày)
                              </span>
                            )}
                          </td>
                          <td className="td text-right">
                            <button
                              onClick={() => navigate(`/sales?mode=pos&action=add&sku=${encodeURIComponent(p.sku)}`)}
                              className="btn-secondary py-1 px-2.5 text-xs rounded-xl font-bold flex items-center gap-1 ml-auto text-sky-600 hover:text-sky-700"
                              title="Xuất bán ngay tại POS"
                            >
                              <ShoppingCart size={13} />
                              Bán ngay
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Kiểm kê / Điều chỉnh tồn kho */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={`Kiểm kê: ${adjustProduct?.name || ''}`}
        icon={<SlidersHorizontal size={18} className="text-amber-500" />}
        footer={
          <>
            <button type="button" onClick={() => setAdjustOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" form="adjust-form" disabled={adjustSaving} className="btn-primary">
              {adjustSaving ? 'Đang cập nhật...' : 'Xác nhận điều chỉnh'}
            </button>
          </>
        }
      >
        {adjustProduct && (
          <form id="adjust-form" onSubmit={handleSaveAdjust} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400">Tồn kho trên hệ thống</p>
                <p className="font-extrabold text-slate-800 text-base">
                  {adjustProduct.currentStock} {adjustProduct.unit || 'Cái'}
                  {formatStockBreakdown(adjustProduct.currentStock, adjustProduct.unit, adjustProduct.units) && (
                    <span className="ml-2 text-xs font-semibold text-sky-600">
                      (≈ {formatStockBreakdown(adjustProduct.currentStock, adjustProduct.unit, adjustProduct.units)})
                    </span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Mã SKU</p>
                <p className="font-mono text-xs text-slate-600 font-bold">{adjustProduct.sku}</p>
              </div>
            </div>

            <div>
              <label className="label">Số lượng thực tế kiểm đếm được ({adjustProduct.unit || 'Cái'}) *</label>
              <input
                type="number"
                min="0"
                required
                autoFocus
                className="input font-extrabold text-lg text-emerald-600"
                value={actualStock}
                onChange={(e) => setActualStock(e.target.value)}
              />
              <p className="text-xs text-slate-400 mt-1">
                Chênh lệch:{' '}
                <span className={`font-bold ${actualStock - adjustProduct.currentStock >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {actualStock - adjustProduct.currentStock >= 0 ? `+${actualStock - adjustProduct.currentStock}` : actualStock - adjustProduct.currentStock}
                </span>{' '}
                {adjustProduct.unit || 'Cái'}
              </p>
            </div>

            {adjustProduct.batches && adjustProduct.batches.length > 0 && (
              <div>
                <label className="label">Lô hàng áp dụng điều chỉnh</label>
                <select
                  className="input text-xs font-semibold"
                  value={adjustBatchId}
                  onChange={(e) => setAdjustBatchId(e.target.value)}
                >
                  <option value="">Tự động phân bổ theo FEFO (Ưu tiên lô cận hạn)</option>
                  {adjustProduct.batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Lô: {b.batchNumber} · Tồn lô: {b.currentQuantity} · HSD: {formatDate(b.expiryDate)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="label">Lý do điều chỉnh *</label>
              <input
                type="text"
                required
                className="input"
                placeholder="VD: Hàng hỏng rách, mất mát, kiểm đếm định kỳ..."
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default Inventory;
