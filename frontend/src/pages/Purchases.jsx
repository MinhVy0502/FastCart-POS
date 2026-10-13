import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Truck, Plus, Search, ArrowLeft, Trash2, CheckCircle, 
  Package, ScanLine, Eye, Building2, UserPlus, Calendar, AlertCircle
} from 'lucide-react';
import api from '../services/api';
import CameraScanner from '../components/CameraScanner';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, MoneyInput, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/format';

const Purchases = () => {
  const [view, setView] = useState('list'); // 'list' | 'create'
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();

  // Filters for List view
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [page, setPage] = useState(1);

  // Create Form State
  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [note, setNote] = useState('');
  const [updateImportPrice, setUpdateImportPrice] = useState(true);
  const [searchProduct, setSearchProduct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  // Detail Modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Quick Supplier Modal
  const [quickSuppOpen, setQuickSuppOpen] = useState(false);
  const [quickSuppForm, setQuickSuppForm] = useState({ name: '', phone: '' });
  const [quickSuppSaving, setQuickSuppSaving] = useState(false);

  const searchInputRef = useRef(null);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (filterSearch.trim()) params.append('search', filterSearch.trim());
      if (filterFrom) params.append('from', filterFrom);
      if (filterTo) params.append('to', filterTo);
      if (filterSupplier) params.append('supplierId', filterSupplier);

      const res = await api.get(`/purchases?${params.toString()}`);
      setPurchases(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách phiếu nhập'));
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [prodRes, suppRes] = await Promise.all([
        api.get('/products?limit=1000'),
        api.get('/suppliers?limit=500')
      ]);
      setProducts(prodRes.data.data || []);
      setSuppliers(suppRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [page, filterSearch, filterFrom, filterTo, filterSupplier]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const sku = params.get('sku');

    if (action === 'add' && sku && products.length > 0) {
      const match = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
      if (match) {
        setView('create');
        handleAddToCart(match);
        navigate('/purchases', { replace: true });
      }
    }
  }, [location.search, products]);

  const handleAddToCart = (product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        price: Number(product.importPrice) || 0
      }]);
    }
    setSearchProduct('');
  };

  const updateCartQty = (id, delta) => {
    const item = cart.find(i => i.productId === id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      setCart(cart.filter(i => i.productId !== id));
      return;
    }
    setCart(cart.map(i => i.productId === id ? { ...i, quantity: newQty } : i));
  };

  const setCartItemField = (id, field, val) => {
    const num = Number(val) || 0;
    setCart(cart.map(i => i.productId === id ? { ...i, [field]: num } : i));
  };

  const removeCartItem = (id) => setCart(cart.filter(item => item.productId !== id));

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  const handleSubmit = async () => {
    if (cart.length === 0) return toast.warning('Vui lòng chọn ít nhất 1 sản phẩm để nhập hàng');
    try {
      setSubmitting(true);
      await api.post('/purchases', {
        supplierId: selectedSupplier || null,
        note,
        updateImportPrice,
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
      });
      toast.success('Nhập hàng thành công! Tồn kho đã được tự động cập nhật.');
      setView('list');
      setCart([]);
      setNote('');
      setSelectedSupplier('');
      fetchPurchases();
      fetchDependencies();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Nhập hàng thất bại'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickCreateSupplier = async (e) => {
    e.preventDefault();
    if (!quickSuppForm.name.trim()) return toast.warning('Vui lòng nhập tên nhà cung cấp');
    try {
      setQuickSuppSaving(true);
      const res = await api.post('/suppliers', quickSuppForm);
      const newSupp = res.data.data;
      toast.success('Đã thêm nhà cung cấp mới');
      setSuppliers([newSupp, ...suppliers]);
      setSelectedSupplier(newSupp.id);
      setQuickSuppOpen(false);
      setQuickSuppForm({ name: '', phone: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Thêm nhà cung cấp thất bại'));
    } finally {
      setQuickSuppSaving(false);
    }
  };

  const handleViewDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/purchases/${id}`);
      setDetailPurchase(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không tải được chi tiết phiếu nhập'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    !searchProduct.trim() || 
    p.name.toLowerCase().includes(searchProduct.toLowerCase()) || 
    p.sku.toLowerCase().includes(searchProduct.toLowerCase())
  );

  // ==========================================
  // CREATE VIEW
  // ==========================================
  if (view === 'create') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="btn-secondary py-2 px-3">
              <ArrowLeft size={18} /> Danh sách phiếu nhập
            </button>
            <h1 className="text-xl font-extrabold text-slate-800">Tạo phiếu nhập hàng mới</h1>
          </div>
          <button 
            onClick={() => setShowScanner(true)}
            className="btn bg-sky-500 hover:bg-sky-600 text-white py-2 px-3.5 shadow-md shadow-sky-500/20"
          >
            <ScanLine size={18} /> Quét mã vạch
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT: Products Selector & Cart */}
          <div className="lg:col-span-2 card p-5 space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                placeholder="Tìm sản phẩm để nhập kho (Tên hoặc mã SKU)..."
                className="input pl-11 py-3 bg-white"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchProduct.trim()) {
                    const match = products.find(p => p.sku.toLowerCase() === searchProduct.trim().toLowerCase());
                    if (match) handleAddToCart(match);
                  }
                }}
              />

              {/* Suggestions dropdown */}
              {searchProduct.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-20 max-h-60 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy sản phẩm</div>
                  ) : (
                    filteredProducts.slice(0, 10).map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleAddToCart(p)}
                        className="p-3 hover:bg-slate-50 flex justify-between items-center cursor-pointer transition-colors"
                      >
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                          <p className="text-xs text-slate-400">SKU: {p.sku} · Tồn kho hiện tại: {p.currentStock}</p>
                        </div>
                        <span className="font-bold text-sky-600 text-sm">{formatCurrency(p.importPrice)}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cart Table */}
            <div className="overflow-x-auto min-h-[220px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                  <Package size={40} className="mb-2 stroke-1" />
                  <p className="text-sm font-medium">Chưa có sản phẩm nào được chọn</p>
                  <p className="text-xs text-slate-400 mt-1">Tìm kiếm sản phẩm ở trên hoặc quét mã vạch</p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs uppercase">
                      <th className="py-2.5">Sản phẩm</th>
                      <th className="py-2.5 text-center w-28">Số lượng nhập</th>
                      <th className="py-2.5 text-right w-36">Giá nhập</th>
                      <th className="py-2.5 text-right w-36">Thành tiền</th>
                      <th className="py-2.5 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.productId}>
                        <td className="py-3">
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{item.sku}</p>
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              className="w-12 text-center font-bold text-sm bg-slate-50 border border-slate-200 rounded-lg py-1"
                              value={item.quantity}
                              onChange={(e) => setCartItemField(item.productId, 'quantity', e.target.value)}
                            />
                            <button
                              type="button"
                              onClick={() => updateCartQty(item.productId, 1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 text-right">
                          <MoneyInput
                            className="input py-1 px-2 text-right font-semibold text-xs"
                            value={item.price}
                            onChange={(val) => setCartItemField(item.productId, 'price', val)}
                          />
                        </td>
                        <td className="py-3 text-right font-extrabold text-slate-800">
                          {formatCurrency(item.quantity * item.price)}
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => removeCartItem(item.productId)} className="text-slate-300 hover:text-rose-500 p-1">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* RIGHT: Supplier & Summary */}
          <div className="card p-5 space-y-4 h-fit">
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Building2 size={18} className="text-sky-500" /> Thông tin đợt nhập
            </h3>

            <div>
              <label className="label">Nhà cung cấp</label>
              <div className="flex gap-2">
                <select
                  className="input flex-1 text-xs"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                >
                  <option value="">-- Chưa chọn nhà cung cấp --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setQuickSuppOpen(true)}
                  className="btn-secondary py-2 px-3 text-xs shrink-0"
                  title="Thêm nhanh nhà cung cấp"
                >
                  <UserPlus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="label">Ghi chú phiếu nhập</label>
              <textarea
                rows="2"
                className="input py-2 text-xs"
                placeholder="Nhập thông tin hóa đơn NCC, biển số xe, người giao..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-400 w-4 h-4"
                  checked={updateImportPrice}
                  onChange={(e) => setUpdateImportPrice(e.target.checked)}
                />
                Tự động cập nhật giá nhập mới cho sản phẩm
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Số loại sản phẩm:</span>
                <span className="font-bold text-slate-700">{cart.length} món</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tổng số lượng nhập:</span>
                <span className="font-bold text-slate-700">{cart.reduce((s, i) => s + i.quantity, 0)} cái/gói</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="font-extrabold text-slate-800 text-sm">TỔNG TIỀN NHẬP:</span>
                <span className="font-extrabold text-sky-600 text-xl">{formatCurrency(totalAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || cart.length === 0}
              className="w-full btn-primary py-3.5 font-bold text-sm shadow-md"
            >
              {submitting ? 'ĐANG LƯU PHIẾU NHẬP...' : 'XÁC NHẬN NHẬP KHO'}
            </button>
          </div>
        </div>

        {/* Camera Scanner */}
        {showScanner && (
          <CameraScanner
            onScan={(code) => {
              const exact = products.find(p => p.sku.toLowerCase() === code.trim().toLowerCase());
              if (exact) {
                handleAddToCart(exact);
                toast.success(`Đã thêm ${exact.name} vào phiếu nhập`);
              } else {
                toast.warning(`Không tìm thấy sản phẩm với mã: ${code}`);
              }
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Quick Supplier Modal */}
        <Modal
          open={quickSuppOpen}
          onClose={() => setQuickSuppOpen(false)}
          title="Thêm nhanh nhà cung cấp"
          icon={<Building2 size={18} className="text-sky-500" />}
          footer={
            <>
              <button type="button" onClick={() => setQuickSuppOpen(false)} className="btn-secondary">Hủy</button>
              <button type="submit" form="quick-supp-form" disabled={quickSuppSaving} className="btn-primary">
                {quickSuppSaving ? 'Đang lưu...' : 'Lưu & Chọn'}
              </button>
            </>
          }
        >
          <form id="quick-supp-form" onSubmit={handleQuickCreateSupplier} className="space-y-4">
            <div>
              <label className="label">Tên nhà cung cấp *</label>
              <input
                type="text"
                required
                autoFocus
                className="input"
                placeholder="VD: Đại lý Phân phối ABC..."
                value={quickSuppForm.name}
                onChange={(e) => setQuickSuppForm({ ...quickSuppForm, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Số điện thoại liên hệ</label>
              <input
                type="tel"
                className="input"
                placeholder="0912 345 678"
                value={quickSuppForm.phone}
                onChange={(e) => setQuickSuppForm({ ...quickSuppForm, phone: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // ==========================================
  // LIST VIEW
  // ==========================================
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Truck}
        color="amber"
        title="Quản lý nhập hàng"
        subtitle="Quản lý các đợt nhập hàng từ nhà cung cấp, tăng tồn kho và cập nhật giá vốn"
        actions={
          <button onClick={() => setView('create')} className="btn-primary">
            <Plus size={18} /> Tạo phiếu nhập
          </button>
        }
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Tìm mã phiếu, tên NCC..."
              className="input pl-10"
              value={filterSearch}
              onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <select
              className="input"
              value={filterSupplier}
              onChange={(e) => { setFilterSupplier(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả nhà cung cấp</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              className="input"
              value={filterFrom}
              onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
            />
          </div>

          <div>
            <input
              type="date"
              className="input"
              value={filterTo}
              onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        {/* Table or Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : purchases.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="Chưa có phiếu nhập hàng nào"
            description="Tạo phiếu nhập khi nhận hàng từ nhà cung cấp để hệ thống cập nhật số lượng tồn kho tự động."
            action={
              <button onClick={() => setView('create')} className="btn-primary">
                <Plus size={16} /> Tạo phiếu nhập đầu tiên
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="th">Mã phiếu</th>
                  <th className="th">Thời gian nhập</th>
                  <th className="th">Nhà cung cấp</th>
                  <th className="th">Người tạo</th>
                  <th className="th text-right">Tổng tiền hàng</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {purchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="td font-bold text-sky-600 font-mono">
                      {p.code}
                    </td>
                    <td className="td text-slate-500 text-xs">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="td font-semibold text-slate-800">
                      {p.supplier?.name || 'Nhà cung cấp lẻ'}
                    </td>
                    <td className="td text-slate-600 text-xs">
                      {p.user?.name || '-'}
                    </td>
                    <td className="td text-right font-extrabold text-slate-800">
                      {formatCurrency(p.totalAmount)}
                    </td>
                    <td className="td text-right">
                      <button
                        onClick={() => handleViewDetail(p.id)}
                        className="icon-btn text-sky-500 hover:bg-sky-50"
                        title="Xem chi tiết phiếu nhập"
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Detail Modal */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`Chi tiết phiếu nhập: ${detailPurchase?.code || ''}`}
        icon={<Truck size={20} className="text-sky-500" />}
        size="lg"
      >
        {detailLoading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : detailPurchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400">Thời gian:</span>
                <p className="font-bold text-slate-700 mt-0.5">{formatDate(detailPurchase.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-400">Nhà cung cấp:</span>
                <p className="font-bold text-slate-700 mt-0.5">{detailPurchase.supplier?.name || 'Không có'}</p>
              </div>
              <div>
                <span className="text-slate-400">Tổng tiền:</span>
                <p className="font-extrabold text-sky-600 text-sm mt-0.5">{formatCurrency(detailPurchase.totalAmount)}</p>
              </div>
            </div>

            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 text-xs">
                  <th className="py-2">Sản phẩm</th>
                  <th className="py-2 text-center">SL nhập</th>
                  <th className="py-2 text-right">Giá nhập</th>
                  <th className="py-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {detailPurchase.items?.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <p className="font-bold text-slate-800">{it.product?.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{it.product?.sku}</p>
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-700">{it.quantity}</td>
                    <td className="py-2.5 text-right text-slate-600">{formatCurrency(it.price)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-800">{formatCurrency(it.quantity * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {detailPurchase.note && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600">
                <span className="font-bold">Ghi chú:</span> {detailPurchase.note}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Purchases;
