import { useState, useEffect } from 'react';
import { 
  Archive, ArrowDownRight, ArrowUpRight, RefreshCw, AlertCircle, 
  Search, SlidersHorizontal, Plus, Calendar, FileSpreadsheet, CheckCircle2 
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatDate, getErrorMessage } from '../utils/format';

const Inventory = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState('stock'); // 'stock' | 'history'

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

  // Stock Adjustment (Kiểm kê) Modal
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState(null);
  const [actualStock, setActualStock] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
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

  const handleOpenAdjust = (p) => {
    setAdjustProduct(p);
    setActualStock(p.currentStock);
    setAdjustReason('');
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
        reason: adjustReason.trim()
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
                placeholder="Tìm sản phẩm theo tên, mã SKU..."
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
                      <th className="th">Mã SKU</th>
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
                          <td className="td font-mono font-bold text-slate-600">{p.sku}</td>
                          <td className="td">
                            <p className="font-bold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.category?.name || 'Không có danh mục'}</p>
                          </td>
                          <td className="td text-center text-slate-500">{p.minStock}</td>
                          <td className="td text-center">
                            <span className={`text-base font-extrabold ${isLow ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {p.currentStock}
                            </span>
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
                          <p className="text-xs text-slate-400 font-mono">{t.product?.sku}</p>
                        </td>
                        <td className="td text-center">
                          <span className={`font-extrabold text-sm ${
                            t.type === 'IN' || (t.type === 'ADJUST' && t.quantity > 0)
                              ? 'text-emerald-600'
                              : 'text-rose-600'
                          }`}>
                            {t.quantity > 0 ? `+${t.quantity}` : t.quantity}
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
                <p className="font-extrabold text-slate-800 text-base">{adjustProduct.currentStock} món</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Mã SKU</p>
                <p className="font-mono text-xs text-slate-600 font-bold">{adjustProduct.sku}</p>
              </div>
            </div>

            <div>
              <label className="label">Số lượng thực tế kiểm đếm được *</label>
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
                món
              </p>
            </div>

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
