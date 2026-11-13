import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Truck, Plus, Search, ArrowLeft, Trash2, CheckCircle, 
  Package, ScanLine, Eye, Building2, UserPlus, Calendar, AlertCircle,
  Ban, Banknote, CreditCard, AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import CameraScanner from '../components/CameraScanner';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, MoneyInput, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, PAYMENT_LABELS, getErrorMessage } from '../utils/format';

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
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // Create Form State
  const [cart, setCart] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'TRANSFER' | 'DEBT'
  const [paidAmount, setPaidAmount] = useState(0);
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
      if (filterStatus) params.append('status', filterStatus);

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
  }, [page, filterSearch, filterFrom, filterTo, filterSupplier, filterStatus]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const sku = params.get('sku');

    if (action === 'add' && sku && products.length > 0) {
      const q = sku.toLowerCase();
      const match = products.find(p => p.sku.toLowerCase() === q || (p.barcode && p.barcode.toLowerCase() === q));
      if (match) {
        setView('create');
        handleAddToCart(match);
        navigate('/purchases', { replace: true });
      }
    }
  }, [location.search, products]);

  const handleAddToCart = (product, matchedUnit = null) => {
    const factor = matchedUnit ? (Number(matchedUnit.conversionFactor) || 1) : 1;
    const unitName = matchedUnit ? matchedUnit.unitName : (product.unit || 'Cái');
    const defaultPrice = Number(product.importPrice) || 0;

    const existing = cart.find(item => item.productId === product.id && item.unitName === unitName);
    if (existing) {
      setCart(cart.map(item => (item.productId === product.id && item.unitName === unitName) ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        baseUnit: product.unit || 'Cái',
        unitName: unitName,
        conversionFactor: factor,
        units: product.units || [],
        hasExpiryDate: Boolean(product.hasExpiryDate),
        quantity: 1,
        price: factor > 1 ? defaultPrice * factor : defaultPrice,
        batchNumber: '',
        expiryDate: '',
        manufacturingDate: ''
      }]);
    }
    setSearchProduct('');
  };

  const handleScanCode = async (rawCode) => {
    const q = rawCode.trim().toLowerCase();
    if (!q) return;

    for (const p of products) {
      if (p.sku.toLowerCase() === q || (p.barcode && p.barcode.toLowerCase() === q)) {
        handleAddToCart(p);
        toast.success(`Đã thêm ${p.name} vào phiếu nhập`);
        return;
      }
      if (p.units && p.units.length > 0) {
        const u = p.units.find(x => x.barcode && x.barcode.toLowerCase() === q);
        if (u) {
          handleAddToCart(p, u);
          toast.success(`Đã thêm ${p.name} (${u.unitName}) vào phiếu nhập`);
          return;
        }
      }
    }

    try {
      const res = await api.get(`/products/sku/${encodeURIComponent(rawCode.trim())}`);
      if (res.data?.data) {
        handleAddToCart(res.data.data, res.data.matchedUnit || null);
        toast.success(`Đã thêm ${res.data.data.name} vào phiếu nhập`);
        return;
      }
    } catch {}

    toast.warning(`Không tìm thấy sản phẩm với mã: ${rawCode}`);
  };

  const handleChangePurchaseUnit = (productId, oldUnitName, targetUnitName) => {
    if (oldUnitName === targetUnitName) return;
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    setCart(prev => {
      const currentItem = prev.find(i => i.productId === productId && i.unitName === oldUnitName);
      if (!currentItem) return prev;

      let factor = 1;
      let unitName = prod.unit || 'Cái';
      const baseImport = Number(prod.importPrice) || 0;

      if (targetUnitName !== (prod.unit || 'Cái') && currentItem.units) {
        const u = currentItem.units.find(x => x.unitName === targetUnitName);
        if (u) {
          factor = Number(u.conversionFactor) || 1;
          unitName = u.unitName;
        }
      }

      const existingTarget = prev.find(i => i.productId === productId && i.unitName === unitName);
      if (existingTarget) {
        return prev
          .filter(i => !(i.productId === productId && i.unitName === oldUnitName))
          .map(i => (i.productId === productId && i.unitName === unitName)
            ? { ...i, quantity: i.quantity + currentItem.quantity }
            : i
          );
      }

      return prev.map(item => {
        if (item.productId !== productId || item.unitName !== oldUnitName) return item;
        return {
          ...item,
          unitName,
          conversionFactor: factor,
          price: baseImport * factor
        };
      });
    });
  };

  const updateCartQty = (id, delta, unitName) => {
    const item = cart.find(i => i.productId === id && (!unitName || i.unitName === unitName));
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      return removeCartItem(id, item.unitName);
    }
    setCart(cart.map(i => (i.productId === id && i.unitName === item.unitName) ? { ...i, quantity: newQty } : i));
  };

  const setCartItemField = (id, field, val, unitName) => {
    const parsedVal = field === 'quantity' ? (Math.max(parseInt(val) || 1, 1)) : (field === 'price' ? (Number(val) || 0) : val);
    setCart(cart.map(i => (i.productId === id && (!unitName || i.unitName === unitName)) ? { ...i, [field]: parsedVal } : i));
  };

  const removeCartItem = (id, unitName) => {
    setCart(cart.filter(item => !(item.productId === id && (!unitName || item.unitName === unitName))));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);

  useEffect(() => {
    if (paymentMethod === 'CASH' || paymentMethod === 'TRANSFER') {
      setPaidAmount(totalAmount);
    } else if (paymentMethod === 'DEBT') {
      setPaidAmount(0);
    }
  }, [totalAmount, paymentMethod]);

  const handleSubmit = async () => {
    if (cart.length === 0) return toast.warning('Vui lòng chọn ít nhất 1 sản phẩm để nhập hàng');
    const unpaid = Math.max(0, totalAmount - paidAmount);
    if ((paymentMethod === 'DEBT' || unpaid > 0) && !selectedSupplier) {
      return toast.warning('Vui lòng chọn Nhà cung cấp nếu ghi nợ phiếu nhập hàng!');
    }

    try {
      setSubmitting(true);
      await api.post('/purchases', {
        supplierId: selectedSupplier || null,
        note,
        updateImportPrice,
        paymentMethod,
        paidAmount: paymentMethod === 'DEBT' ? paidAmount : totalAmount,
        items: cart.map(i => ({
          productId: i.productId,
          quantity: i.quantity,
          price: i.price,
          unitName: i.unitName,
          conversionFactor: i.conversionFactor || 1,
          batchNumber: i.batchNumber ? i.batchNumber.trim() : null,
          expiryDate: i.expiryDate || null,
          manufacturingDate: i.manufacturingDate || null
        }))
      });
      toast.success('Nhập hàng thành công! Tồn kho đã được tự động cập nhật.');
      setView('list');
      setCart([]);
      setNote('');
      setSelectedSupplier('');
      setPaymentMethod('CASH');
      setPaidAmount(0);
      fetchPurchases();
      fetchDependencies();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Nhập hàng thất bại'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPurchase = async (purchase) => {
    const reason = await confirm({
      title: 'Hủy phiếu nhập & Thu hồi tồn kho?',
      message: `Phiếu nhập "${purchase.code}" sẽ chuyển sang "ĐÃ HỦY". Hệ thống sẽ trừ ngược lại số lượng đã nhập trong kho và giảm công nợ Nhà cung cấp (nếu có).`,
      danger: true,
      confirmText: 'Xác nhận hủy phiếu',
      input: { placeholder: 'Nhập lý do hủy phiếu nhập (tùy chọn)...' }
    });
    if (!reason && reason !== '') return;

    try {
      await api.post(`/purchases/${purchase.id}/cancel`, { reason: typeof reason === 'string' ? reason : '' });
      toast.success('Đã hủy phiếu nhập và cập nhật lại tồn kho!');
      fetchPurchases();
      fetchDependencies();
      if (detailPurchase?.id === purchase.id) {
        setDetailOpen(false);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Hủy phiếu nhập thất bại'));
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

  const filteredProducts = products.filter(p => {
    const q = searchProduct.trim().toLowerCase();
    return !q || 
      p.name.toLowerCase().includes(q) || 
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q)) ||
      (p.units && p.units.some(u => u.barcode && u.barcode.toLowerCase().includes(q)));
  });

  // ==========================================
  // CREATE VIEW
  // ==========================================
  if (view === 'create') {
    const currentSupp = suppliers.find(s => s.id === selectedSupplier);
    const suppCurrentDebt = Number(currentSupp?.currentDebt) || 0;
    const unpaidPurchase = Math.max(0, totalAmount - paidAmount);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('list')} className="btn-secondary py-2 px-3">
              <ArrowLeft size={18} /> Danh sách phiếu nhập
            </button>
            <h1 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Tạo phiếu nhập hàng mới</h1>
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
                placeholder="Tìm sản phẩm để nhập kho (Tên, SKU hoặc mã vạch)..."
                className="input pl-11 py-3 bg-white dark:bg-[#151f33]"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchProduct.trim()) {
                    handleScanCode(searchProduct);
                  }
                }}
              />

              {/* Suggestions dropdown */}
              {searchProduct.trim() && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151f33] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-20 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">Không tìm thấy sản phẩm</div>
                  ) : (
                    filteredProducts.slice(0, 10).map(p => (
                      <div
                        key={p.id}
                        onClick={() => handleAddToCart(p)}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex justify-between items-center gap-2 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono">
                            SKU: {p.sku}
                            {p.barcode && <span className="ml-1 text-sky-500">· {p.barcode}</span>}
                            <span className="ml-1 font-sans text-slate-500">· Tồn: {p.currentStock} {p.unit || 'Cái'}</span>
                          </p>
                          {p.units && p.units.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                              {p.units.map((u) => (
                                <button
                                  key={u.id || u.unitName}
                                  type="button"
                                  onClick={() => handleAddToCart(p, u)}
                                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 hover:bg-sky-500 hover:text-white"
                                >
                                  + Nhập theo {u.unitName} ({u.conversionFactor} {p.unit})
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-sky-600 text-xs sm:text-sm shrink-0">
                          {formatCurrency(p.importPrice)}/{p.unit || 'Cái'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Cart Items (Mobile Cards + Desktop Table) */}
            <div className="min-h-[220px]">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                  <Package size={40} className="mb-2 stroke-1" />
                  <p className="text-sm font-medium">Chưa có sản phẩm nào được chọn</p>
                  <p className="text-xs text-slate-400 mt-1">Tìm kiếm sản phẩm ở trên hoặc bấm Quét mã vạch</p>
                </div>
              ) : (
                <>
                  {/* Mobile Cart List (< 768px) */}
                  <div className="md:hidden space-y-2.5">
                    {cart.map((item, cIdx) => (
                      <div
                        key={`${item.productId}-${item.unitName || item.unit}-${cIdx}`}
                        className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{item.name}</p>
                            <span className="text-[11px] text-slate-400 font-mono">{item.barcode || item.sku}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.productId, item.unitName)}
                            className="text-slate-400 hover:text-rose-500 p-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {/* Chọn nhanh ĐVT nhập (Lon / Lốc / Thùng) */}
                        {item.units && item.units.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400 mr-0.5">ĐVT nhập:</span>
                            <button
                              type="button"
                              onClick={() => handleChangePurchaseUnit(item.productId, item.unitName, item.baseUnit)}
                              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                                item.unitName === item.baseUnit
                                  ? 'bg-sky-500 text-white border-sky-500'
                                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {item.baseUnit}
                            </button>
                            {item.units.map((u) => (
                              <button
                                key={u.id || u.unitName}
                                type="button"
                                onClick={() => handleChangePurchaseUnit(item.productId, item.unitName, u.unitName)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition-all ${
                                  item.unitName === u.unitName
                                    ? 'bg-sky-500 text-white border-sky-500'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                {u.unitName} (x{u.conversionFactor})
                              </button>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2.5 items-center pt-1">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">Số lượng ({item.unitName})</span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.productId, -1, item.unitName)}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="1"
                                className="w-14 text-center font-bold text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-1.5"
                                value={item.quantity}
                                onChange={(e) => setCartItemField(item.productId, 'quantity', e.target.value, item.unitName)}
                              />
                              <button
                                type="button"
                                onClick={() => updateCartQty(item.productId, 1, item.unitName)}
                                className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block mb-1">Đơn giá nhập / {item.unitName}</span>
                            <MoneyInput
                              className="input py-1.5 px-2.5 text-right font-bold text-xs bg-white dark:bg-slate-800"
                              value={item.price}
                              onChange={(val) => setCartItemField(item.productId, 'price', val, item.unitName)}
                            />
                          </div>
                        </div>

                        {item.hasExpiryDate && (
                          <div className="grid grid-cols-2 gap-2 bg-amber-50/70 dark:bg-amber-950/30 p-2 rounded-xl border border-amber-200/50 text-xs">
                            <input
                              type="text"
                              placeholder="Số lô (VD: LOT-01)"
                              className="input py-1 px-2 text-xs font-mono bg-white dark:bg-slate-800"
                              value={item.batchNumber}
                              onChange={(e) => setCartItemField(item.productId, 'batchNumber', e.target.value, item.unitName)}
                            />
                            <input
                              type="date"
                              className="input py-1 px-2 text-xs bg-white dark:bg-slate-800"
                              value={item.expiryDate}
                              onChange={(e) => setCartItemField(item.productId, 'expiryDate', e.target.value, item.unitName)}
                            />
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                          <span className="text-slate-400">
                            Quy đổi nhập kho: <b className="text-slate-600 dark:text-slate-300">+{item.quantity * (item.conversionFactor || 1)} {item.baseUnit}</b>
                          </span>
                          <span className="font-black text-sky-600 text-sm">
                            {formatCurrency(item.quantity * item.price)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table (>= 768px) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs uppercase">
                          <th className="py-2.5">Sản phẩm</th>
                          <th className="py-2.5 text-center w-28">Số lượng nhập</th>
                          <th className="py-2.5 text-right w-36">Giá nhập</th>
                          <th className="py-2.5 text-right w-36">Thành tiền</th>
                          <th className="py-2.5 text-right w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {cart.map((item, cIdx) => (
                          <tr key={`${item.productId}-${item.unitName || item.unit}-${cIdx}`}>
                            <td className="py-3">
                              <p className="font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-slate-400 font-mono">
                                  {item.sku}
                                  {item.barcode && <span className="ml-1 text-sky-500">· {item.barcode}</span>}
                                </span>

                                {item.units && item.units.length > 0 && (
                                  <select
                                    className="bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-sky-600 dark:text-sky-400 rounded-lg border border-slate-200 dark:border-slate-700 py-0.5 px-1.5 focus:outline-none"
                                    value={item.unitName}
                                    onChange={(e) => handleChangePurchaseUnit(item.productId, item.unitName, e.target.value)}
                                  >
                                    <option value={item.baseUnit}>{item.baseUnit} (Gốc)</option>
                                    {item.units.map(u => (
                                      <option key={u.id || u.unitName} value={u.unitName}>
                                        {u.unitName} (x{u.conversionFactor} {item.baseUnit})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>

                              {item.hasExpiryDate && (
                                <div className="mt-2 flex items-center gap-2 flex-wrap text-xs bg-amber-50/70 dark:bg-amber-950/30 p-1.5 rounded-lg border border-amber-200/50 dark:border-amber-800/40">
                                  <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 shrink-0">
                                    Lô & HSD:
                                  </span>
                                  <input
                                    type="text"
                                    placeholder="Số lô (VD: LOT-01)..."
                                    className="input py-0.5 px-2 text-xs font-mono w-28 bg-white dark:bg-slate-800"
                                    value={item.batchNumber}
                                    onChange={(e) => setCartItemField(item.productId, 'batchNumber', e.target.value, item.unitName)}
                                  />
                                  <input
                                    type="date"
                                    className="input py-0.5 px-2 text-xs w-32 bg-white dark:bg-slate-800"
                                    value={item.expiryDate}
                                    onChange={(e) => setCartItemField(item.productId, 'expiryDate', e.target.value, item.unitName)}
                                  />
                                </div>
                              )}
                            </td>
                            <td className="py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.productId, -1, item.unitName)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  className="w-12 text-center font-bold text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1"
                                  value={item.quantity}
                                  onChange={(e) => setCartItemField(item.productId, 'quantity', e.target.value, item.unitName)}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateCartQty(item.productId, 1, item.unitName)}
                                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm"
                                >
                                  +
                                </button>
                                <span className="text-xs text-slate-400 font-medium ml-1">{item.unitName || item.unit || 'Cái'}</span>
                              </div>
                            </td>
                            <td className="py-3 text-right">
                              <MoneyInput
                                className="input py-1 px-2 text-right font-semibold text-xs"
                                value={item.price}
                                onChange={(val) => setCartItemField(item.productId, 'price', val, item.unitName)}
                              />
                            </td>
                            <td className="py-3 text-right font-extrabold text-slate-800 dark:text-slate-100">
                              {formatCurrency(item.quantity * item.price)}
                            </td>
                            <td className="py-3 text-right">
                              <button onClick={() => removeCartItem(item.productId, item.unitName)} className="text-slate-300 hover:text-rose-500 p-1">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT: Supplier & Summary */}
          <div className="card p-5 space-y-4 h-fit">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base flex items-center gap-2">
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
              {currentSupp && (
                <div className="flex justify-between text-[11px] text-slate-500 mt-1.5 px-1">
                  <span>Nợ cần trả NCC hiện tại:</span>
                  <b className={suppCurrentDebt > 0 ? 'text-rose-600' : 'text-slate-700'}>{formatCurrency(suppCurrentDebt)}</b>
                </div>
              )}
            </div>

            {/* Hình thức thanh toán cho NCC */}
            <div>
              <label className="label">Hình thức thanh toán NCC</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('CASH'); setPaidAmount(totalAmount); }}
                  className={`py-2 px-1.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Banknote size={14} /> Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('TRANSFER'); setPaidAmount(totalAmount); }}
                  className={`py-2 px-1.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'TRANSFER'
                      ? 'border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard size={14} /> Chuyển khoản
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('DEBT'); setPaidAmount(0); }}
                  className={`py-2 px-1.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'DEBT'
                      ? 'border-rose-500 bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Building2 size={14} /> Nợ NCC
                </button>
              </div>
            </div>

            {paymentMethod === 'DEBT' && (
              <div className="bg-rose-50/60 p-3 rounded-2xl border border-rose-200/70 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-rose-700">Trả trước cho NCC:</span>
                  <MoneyInput
                    className="input py-1 px-2 text-right font-bold w-36 text-xs bg-white"
                    value={paidAmount}
                    onChange={(v) => setPaidAmount(Math.min(v, totalAmount))}
                  />
                </div>
                <div className="flex justify-between text-slate-600 pt-1 border-t border-rose-200/50">
                  <span>Nợ phát sinh phiếu này:</span>
                  <span className="font-bold text-rose-600">{formatCurrency(unpaidPurchase)}</span>
                </div>
                {currentSupp ? (
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>Tổng nợ NCC sau nhập:</span>
                    <span className="text-rose-700">{formatCurrency(suppCurrentDebt + unpaidPurchase)}</span>
                  </div>
                ) : (
                  <div className="text-rose-600 font-semibold flex items-center gap-1 pt-0.5">
                    <AlertTriangle size={13} className="shrink-0" />
                    <span>Vui lòng chọn Nhà cung cấp ở trên để ghi nợ!</span>
                  </div>
                )}
              </div>
            )}

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

            <div className="pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-sky-500 focus:ring-sky-400 w-4 h-4"
                  checked={updateImportPrice}
                  onChange={(e) => setUpdateImportPrice(e.target.checked)}
                />
                Tự động cập nhật giá nhập mới cho sản phẩm
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Số loại sản phẩm:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{cart.length} món</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Tổng số lượng nhập:</span>
                <span className="font-bold text-slate-700 dark:text-slate-200">{cart.reduce((s, i) => s + i.quantity, 0)} đơn vị</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">TỔNG TIỀN NHẬP:</span>
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
            onScan={(code) => handleScanCode(code)}
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
        subtitle="Quản lý các đợt nhập hàng từ nhà cung cấp, tăng tồn kho, theo dõi công nợ NCC và cập nhật giá vốn"
        actions={
          <button onClick={() => setView('create')} className="btn-primary">
            <Plus size={18} /> Tạo phiếu nhập
          </button>
        }
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

          <div>
            <select
              className="input"
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="COMPLETED">Hoàn thành</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </div>
        </div>

        {/* Table or Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
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
          <>
            {/* Mobile Card List (< 768px) */}
            <div className="md:hidden space-y-2.5">
              {purchases.map((p) => {
                const isCancelled = p.status === 'CANCELLED';
                const unpaid = Math.max(0, Number(p.totalAmount || 0) - Number(p.paidAmount ?? p.totalAmount));
                return (
                  <div
                    key={p.id}
                    onClick={() => handleViewDetail(p.id)}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/40 active:scale-[0.99] transition-all cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sky-600 text-sm">{p.code}</span>
                          <span className={`chip text-[10px] py-0.5 px-2 ${isCancelled ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isCancelled ? 'Đã hủy' : 'Hoàn thành'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1">
                          {p.supplier?.name || 'Nhà cung cấp lẻ'}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatDate(p.createdAt)} · {PAYMENT_LABELS[p.paymentMethod] || 'Tiền mặt'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-base text-slate-800 dark:text-slate-100">{formatCurrency(p.totalAmount)}</p>
                        {!isCancelled && unpaid > 0 && (
                          <p className="text-[11px] font-bold text-rose-600 mt-0.5">Nợ NCC: {formatCurrency(unpaid)}</p>
                        )}
                        <div className="flex items-center justify-end gap-1 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleViewDetail(p.id)}
                            className="icon-btn text-sky-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                            title="Xem chi tiết"
                          >
                            <Eye size={15} />
                          </button>
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancelPurchase(p)}
                              className="icon-btn text-rose-500 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                              title="Hủy phiếu"
                            >
                              <Ban size={15} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="th">Mã phiếu</th>
                    <th className="th">Thời gian nhập</th>
                    <th className="th">Nhà cung cấp</th>
                    <th className="th">Thanh toán</th>
                    <th className="th">Trạng thái</th>
                    <th className="th text-right">Tổng tiền hàng</th>
                    <th className="th text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {purchases.map((p) => {
                    const isCancelled = p.status === 'CANCELLED';
                    const unpaid = Math.max(0, Number(p.totalAmount || 0) - Number(p.paidAmount ?? p.totalAmount));
                    return (
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
                        <td className="td text-xs text-slate-600">
                          <div>{PAYMENT_LABELS[p.paymentMethod] || 'Tiền mặt'}</div>
                          {!isCancelled && unpaid > 0 && (
                            <span className="text-[11px] font-bold text-rose-600">Nợ: {formatCurrency(unpaid)}</span>
                          )}
                        </td>
                        <td className="td">
                          <span className={`chip ${isCancelled ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isCancelled ? 'Đã hủy' : 'Hoàn thành'}
                          </span>
                        </td>
                        <td className="td text-right font-extrabold text-slate-800">
                          {formatCurrency(p.totalAmount)}
                        </td>
                        <td className="td text-right space-x-1">
                          <button
                            onClick={() => handleViewDetail(p.id)}
                            className="icon-btn text-sky-500 hover:bg-sky-50"
                            title="Xem chi tiết phiếu nhập"
                          >
                            <Eye size={17} />
                          </button>
                          {!isCancelled && (
                            <button
                              onClick={() => handleCancelPurchase(p)}
                              className="icon-btn text-rose-500 hover:bg-rose-50"
                              title="Hủy phiếu nhập (Thu hồi tồn kho)"
                            >
                              <Ban size={17} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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
        footer={
          detailPurchase && (
            <div className="flex justify-between items-center w-full">
              {detailPurchase.status !== 'CANCELLED' ? (
                <button
                  onClick={() => handleCancelPurchase(detailPurchase)}
                  className="btn-danger text-xs py-2"
                >
                  <Ban size={15} /> Hủy phiếu nhập này
                </button>
              ) : <div />}
              <button onClick={() => setDetailOpen(false)} className="btn-secondary">Đóng</button>
            </div>
          )
        }
      >
        {detailLoading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : detailPurchase && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div>
                <span className="text-slate-400">Thời gian:</span>
                <p className="font-bold text-slate-700 mt-0.5">{formatDate(detailPurchase.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-400">Nhà cung cấp:</span>
                <p className="font-bold text-slate-700 mt-0.5">{detailPurchase.supplier?.name || 'Không có'}</p>
              </div>
              <div>
                <span className="text-slate-400">Trạng thái:</span>
                <p className={`font-bold mt-0.5 ${detailPurchase.status === 'CANCELLED' ? 'text-rose-500' : 'text-emerald-600'}`}>
                  {detailPurchase.status === 'CANCELLED' ? 'ĐÃ HỦY' : 'HOÀN THÀNH'}
                </p>
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
                      {it.batchNumber && (
                        <p className="text-[11px] text-amber-600 font-mono mt-0.5">
                          Lô: {it.batchNumber} {it.expiryDate ? `· HSD: ${formatDate(it.expiryDate)}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-700">
                      {it.quantity} {it.unitName || it.product?.unit || 'Cái'}
                    </td>
                    <td className="py-2.5 text-right text-slate-600">{formatCurrency(it.price)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-800">{formatCurrency(it.quantity * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-xs text-right">
              <div className="flex justify-between text-slate-500">
                <span>Đã thanh toán ({PAYMENT_LABELS[detailPurchase.paymentMethod] || 'Tiền mặt'}):</span>
                <span className="font-bold text-slate-700">{formatCurrency(detailPurchase.paidAmount ?? detailPurchase.totalAmount)}</span>
              </div>
              {Number(detailPurchase.totalAmount) > Number(detailPurchase.paidAmount ?? detailPurchase.totalAmount) && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Ghi nợ NCC phiếu này:</span>
                  <span>{formatCurrency(Number(detailPurchase.totalAmount) - Number(detailPurchase.paidAmount || 0))}</span>
                </div>
              )}
            </div>

            {detailPurchase.note && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 whitespace-pre-line">
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
