import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Plus, Search, ArrowLeft, Trash2, CheckCircle, 
  Store, Calculator, Ticket, ScanLine, Printer, Ban, Eye, 
  Calendar, UserPlus, CreditCard, Banknote, RefreshCw, X, MapPin, Layers,
  FileText, AlertTriangle, ChevronRight
} from 'lucide-react';
import api from '../services/api';
import CameraScanner from '../components/CameraScanner';
import { useToast } from '../contexts/ToastContext';
import { useStore } from '../contexts/StoreContext';
import { PageHeader, Modal, MoneyInput, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, PAYMENT_LABELS, getErrorMessage } from '../utils/format';
import { printReceipt, printDeliveryNote } from '../utils/print';
import { vietQrUrl } from '../constants/banks';

const Sales = () => {
  const [view, setView] = useState('list'); // 'list' | 'pos'
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const { settings } = useStore();

  // Filters for History view
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  // POS State
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [priceMode, setPriceMode] = useState('RETAIL'); // 'RETAIL' | 'WHOLESALE'
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' | 'percent'
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // 'CASH' | 'TRANSFER' | 'DEBT'
  const [customerPaid, setCustomerPaid] = useState(0);
  const [note, setNote] = useState('');
  const [searchProduct, setSearchProduct] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [activeCategory, setActiveCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [activeShelf, setActiveShelf] = useState('');
  const [shelves, setShelves] = useState([]);

  // Detail Modal
  const [detailSale, setDetailSale] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // Success / Print Choice Modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [completedSale, setCompletedSale] = useState(null);
  const [completedWarning, setCompletedWarning] = useState(null);

  // Quick Customer Create Modal
  const [quickCustOpen, setQuickCustOpen] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({
    name: '',
    customerType: 'RETAIL',
    storeName: '',
    phone: '',
    debtLimit: 0
  });
  const [quickCustSaving, setQuickCustSaving] = useState(false);

  const searchInputRef = useRef(null);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (filterSearch.trim()) params.append('search', filterSearch.trim());
      if (filterFrom) params.append('from', filterFrom);
      if (filterTo) params.append('to', filterTo);
      if (filterStatus) params.append('status', filterStatus);

      const res = await api.get(`/sales?${params.toString()}`);
      setSales(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải lịch sử hóa đơn'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProductsAndCustomers = async () => {
    try {
      const [prodRes, custRes, catRes, shelfRes] = await Promise.all([
        api.get('/products?limit=1000'),
        api.get('/customers?limit=500'),
        api.get('/categories'),
        api.get('/shelves')
      ]);
      setProducts(prodRes.data.data || []);
      setCustomers(custRes.data.data || []);
      setCategories(catRes.data.data || []);
      setShelves(shelfRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [page, filterSearch, filterFrom, filterTo, filterStatus]);

  useEffect(() => {
    fetchProductsAndCustomers();
  }, []);

  // Handle URL query parameters (e.g. ?mode=pos, ?action=add&sku=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const action = params.get('action');
    const sku = params.get('sku');

    if (mode === 'pos') {
      setView('pos');
    }

    if (action === 'add' && sku && products.length > 0) {
      const match = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
      if (match) {
        setView('pos');
        handleAddToCart(match);
        navigate('/sales?mode=pos', { replace: true });
      }
    }
  }, [location.search, products]);

  // Keyboard shortcuts in POS (F2: focus search, F9: checkout)
  useEffect(() => {
    if (view === 'pos') {
      searchInputRef.current?.focus({ preventScroll: true });
    }
  }, [view]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (view !== 'pos') return;
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus({ preventScroll: true });
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !submitting) {
          handleCheckout();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, cart, submitting]);

  const handleAddToCart = (product) => {
    if (product.currentStock <= 0) {
      return toast.warning(`Sản phẩm "${product.name}" hiện đã hết hàng trong kho!`);
    }

    const isWs = priceMode === 'WHOLESALE';
    const effectivePrice = isWs && Number(product.wholesalePrice) > 0
      ? Number(product.wholesalePrice)
      : (Number(product.salePrice) || 0);

    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.currentStock) {
        return toast.warning(`Chỉ còn ${product.currentStock} sản phẩm trong kho!`);
      }
      setCart(cart.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        shelf: product.shelf,
        maxStock: product.currentStock,
        quantity: 1,
        price: effectivePrice,
        salePrice: Number(product.salePrice) || 0,
        wholesalePrice: Number(product.wholesalePrice) || 0,
        isWholesalePrice: isWs && Number(product.wholesalePrice) > 0
      }]);
    }
    setSearchProduct('');
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomer(customerId);
    const cust = customers.find(c => c.id === customerId);
    if (cust?.customerType === 'WHOLESALE') {
      setPriceMode('WHOLESALE');
      setCart(prev => prev.map(item => {
        const prod = products.find(p => p.id === item.productId);
        const wsPrice = Number(prod?.wholesalePrice) > 0 ? Number(prod.wholesalePrice) : Number(item.salePrice || item.price);
        return {
          ...item,
          price: wsPrice,
          isWholesalePrice: Number(prod?.wholesalePrice) > 0
        };
      }));
      toast.info(`Đã tự động áp dụng giá sỉ cho đại lý "${cust.storeName || cust.name}"`);
    }
  };

  const handleTogglePriceMode = (mode) => {
    setPriceMode(mode);
    setCart(prev => prev.map(item => {
      const prod = products.find(p => p.id === item.productId);
      if (mode === 'WHOLESALE') {
        const wsPrice = Number(prod?.wholesalePrice) > 0 ? Number(prod.wholesalePrice) : (item.salePrice || item.price);
        return { ...item, price: wsPrice, isWholesalePrice: Number(prod?.wholesalePrice) > 0 };
      } else {
        const retailPrice = Number(prod?.salePrice) || item.salePrice || item.price;
        return { ...item, price: retailPrice, isWholesalePrice: false };
      }
    }));
  };

  const updateCartQty = (id, delta) => {
    const item = cart.find(i => i.productId === id);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      return removeCartItem(id);
    }
    if (newQty > item.maxStock) {
      return toast.warning(`Chỉ còn ${item.maxStock} sản phẩm trong kho!`);
    }
    setCart(cart.map(i => i.productId === id ? { ...i, quantity: newQty } : i));
  };

  const setCartItemField = (id, field, val) => {
    const num = Number(val) || 0;
    if (field === 'quantity') {
      const item = cart.find(i => i.productId === id);
      if (num > item.maxStock) {
        toast.warning(`Chỉ còn ${item.maxStock} sản phẩm trong kho!`);
        return;
      }
    }
    setCart(cart.map(i => i.productId === id ? { ...i, [field]: num } : i));
  };

  const removeCartItem = (id) => setCart(cart.filter(item => item.productId !== id));

  // Calculations
  const totalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  const calculatedDiscount = discountType === 'percent' 
    ? Math.round((totalAmount * discountPercent) / 100) 
    : discount;
  const finalAmount = Math.max(totalAmount - calculatedDiscount, 0);
  const changeDue = paymentMethod === 'CASH' ? Math.max(customerPaid - finalAmount, 0) : 0;

  // Auto-fill customerPaid when finalAmount changes if user hasn't typed a custom amount
  useEffect(() => {
    if (paymentMethod === 'CASH' || paymentMethod === 'TRANSFER') {
      setCustomerPaid(finalAmount);
    } else if (paymentMethod === 'DEBT') {
      setCustomerPaid(0);
    }
  }, [finalAmount, paymentMethod]);

  const handleCheckout = async () => {
    if (cart.length === 0) return toast.warning('Giỏ hàng đang trống!');
    if (calculatedDiscount > totalAmount) return toast.warning('Giảm giá không được lớn hơn tổng tiền!');

    const unpaid = Math.max(0, finalAmount - customerPaid);
    if ((paymentMethod === 'DEBT' || unpaid > 0) && !selectedCustomer) {
      return toast.warning('Chỉ khách hàng / đại lý có lưu tên mới được mua nợ. Vui lòng chọn khách hàng!');
    }
    if (paymentMethod === 'CASH' && customerPaid < finalAmount && !selectedCustomer) {
      return toast.warning('Tiền khách đưa chưa đủ!');
    }

    try {
      setSubmitting(true);
      const res = await api.post('/sales', {
        customerId: selectedCustomer || null,
        note,
        discount: calculatedDiscount,
        paymentMethod,
        customerPaid: paymentMethod === 'DEBT' ? customerPaid : (paymentMethod === 'CASH' ? customerPaid : finalAmount),
        items: cart.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.price }))
      });

      const newSale = res.data.data;
      const custObj = customers.find(c => c.id === selectedCustomer);
      const fullSale = {
        ...newSale,
        customer: custObj,
        items: cart
      };

      toast.success('Tạo hóa đơn thành công!');

      // Open print choice dialog
      setCompletedSale(fullSale);
      setCompletedWarning(res.data.debtWarning || null);
      setSuccessModalOpen(true);

      // Reset POS
      setCart([]);
      setNote('');
      setDiscount(0);
      setDiscountPercent(0);
      setSelectedCustomer('');
      setCustomerPaid(0);

      // Refresh list & products stock
      fetchSales();
      fetchProductsAndCustomers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Thanh toán thất bại'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickCreateCustomer = async (e) => {
    e.preventDefault();
    if (!quickCustForm.name.trim()) return toast.warning('Vui lòng nhập tên khách hàng');
    try {
      setQuickCustSaving(true);
      const res = await api.post('/customers', quickCustForm);
      const newCust = res.data.data;
      toast.success('Đã thêm khách hàng mới');
      setCustomers([newCust, ...customers]);
      setSelectedCustomer(newCust.id);
      setQuickCustOpen(false);
      setQuickCustForm({ name: '', phone: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Thêm khách hàng thất bại'));
    } finally {
      setQuickCustSaving(false);
    }
  };

  const handleViewDetail = async (saleId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const res = await api.get(`/sales/${saleId}`);
      setDetailSale(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không tải được chi tiết hóa đơn'));
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancelSale = async (sale) => {
    const reason = await confirm({
      title: 'Hủy hóa đơn & Hoàn tồn kho?',
      message: `Hóa đơn "${sale.code}" sẽ được chuyển trạng thái sang "ĐÃ HỦY". Toàn bộ số lượng các món trong đơn sẽ tự động được HOÀN LẠI VÀO KHO.`,
      danger: true,
      confirmText: 'Xác nhận hủy',
      input: { placeholder: 'Nhập lý do hủy hóa đơn (tùy chọn)...' }
    });
    if (!reason && reason !== '') return;

    try {
      await api.post(`/sales/${sale.id}/cancel`, { reason: typeof reason === 'string' ? reason : '' });
      toast.success('Đã hủy hóa đơn và hoàn tồn kho thành công!');
      fetchSales();
      fetchProductsAndCustomers();
      if (detailSale?.id === sale.id) {
        setDetailOpen(false);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Hủy hóa đơn thất bại'));
    }
  };

  const filteredCatalog = products.filter(p => {
    const matchesSearch = !searchProduct.trim() || 
      p.name.toLowerCase().includes(searchProduct.toLowerCase()) || 
      p.sku.toLowerCase().includes(searchProduct.toLowerCase());
    const matchesCat = !activeCategory || p.categoryId === activeCategory;
    const matchesShelf = !activeShelf || p.shelfId === activeShelf;
    return matchesSearch && matchesCat && matchesShelf;
  });

  // ==========================================
  // POS VIEW (BÁN HÀNG THU NGÂN)
  // ==========================================
  if (view === 'pos') {
    return (
      <div className="flex-1 flex flex-col min-h-0 gap-3">
        {/* Top POS bar */}
        <div className="flex items-center justify-between pb-1 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => { setView('list'); navigate('/sales'); }} 
              className="btn-secondary py-2 px-3.5 text-slate-700 dark:text-slate-200 rounded-full dark:bg-[#151f33] dark:border-slate-700 text-xs sm:text-sm font-semibold"
            >
              <ArrowLeft size={18} /> Danh sách hóa đơn
            </button>
            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 dark:text-slate-100 hidden sm:block">Thu ngân Bán hàng (POS)</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden md:inline text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full font-mono">
              [F2] Tìm kiếm · [F9] Thanh toán
            </span>
            <button 
              onClick={() => setShowScanner(true)}
              className="btn-primary py-2 px-4 rounded-full text-xs sm:text-sm shadow-sm shadow-sky-400/25"
              title="Quét mã vạch camera"
            >
              <ScanLine size={18} /> Quét mã
            </button>
          </div>
        </div>

        {/* 2 Columns: Products & Cart/Checkout */}
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
          {/* LEFT: Product Catalog & Search */}
          <div className="lg:w-7/12 flex flex-col gap-3 min-h-0">
            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm sản phẩm theo tên, mã SKU hoặc quét mã vạch (F2)..."
                className="input pl-11 py-2.5 text-sm bg-white dark:bg-[#151f33] shadow-sm"
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchProduct.trim()) {
                    const exact = products.find(p => p.sku.toLowerCase() === searchProduct.trim().toLowerCase());
                    if (exact) handleAddToCart(exact);
                  }
                }}
              />
            </div>

            {/* Category tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
              <button
                onClick={() => setActiveCategory('')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                  !activeCategory 
                    ? 'bg-sky-400 text-white shadow-sm shadow-sky-400/25' 
                    : 'bg-white dark:bg-[#151f33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                Tất cả ngành hàng ({products.length})
              </button>
              {categories.map(c => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(activeCategory === c.id ? '' : c.id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition-all ${
                    activeCategory === c.id 
                      ? 'bg-sky-400 text-white shadow-sm shadow-sky-400/25' 
                      : 'bg-white dark:bg-[#151f33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Shelf tabs / pills */}
            {shelves.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide shrink-0">
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 pl-1 mr-0.5">
                  <Layers size={13} className="text-amber-500" /> Kệ:
                </span>
                <button
                  onClick={() => setActiveShelf('')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all ${
                    !activeShelf 
                      ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25' 
                      : 'bg-white dark:bg-[#151f33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  Tất cả kệ
                </button>
                {shelves.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setActiveShelf(activeShelf === s.id ? '' : s.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-all flex items-center gap-1 ${
                      activeShelf === s.id 
                        ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25' 
                        : 'bg-white dark:bg-[#151f33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{s.code ? `[${s.code}] ` : ''}{s.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Product Grid / Empty State */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {filteredCatalog.length === 0 ? (
                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center p-6 bg-white dark:bg-[#151f33] rounded-3xl border border-dashed border-slate-200 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-400 flex items-center justify-center mb-3">
                    <Store size={32} />
                  </div>
                  {products.length === 0 ? (
                    <>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">Cửa hàng chưa có sản phẩm</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-400 max-w-sm mb-4">
                        Hãy thêm sản phẩm mới hoặc nhập kho để bắt đầu tạo đơn hàng bán lẻ.
                      </p>
                      <button
                        onClick={() => navigate('/products')}
                        className="btn-primary text-xs py-2 px-4 rounded-full"
                      >
                        Thêm sản phẩm ngay
                      </button>
                    </>
                  ) : (
                    <>
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">Không tìm thấy sản phẩm phù hợp</h4>
                      <p className="text-xs text-slate-400 dark:text-slate-400 max-w-sm mb-4">
                        Không có mặt hàng nào khớp với bộ lọc hiện tại.
                      </p>
                      <button
                        onClick={() => { setSearchProduct(''); setActiveCategory(''); setActiveShelf(''); }}
                        className="btn-secondary text-xs py-2 px-4 rounded-full"
                      >
                        Xóa bộ lọc
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {filteredCatalog.map(p => {
                    const isOutOfStock = p.currentStock <= 0;
                    return (
                      <div
                        key={p.id}
                        onClick={() => !isOutOfStock && handleAddToCart(p)}
                        className={`card p-3 flex flex-col justify-between cursor-pointer transition-all hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-md active:scale-95 select-none ${
                          isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800/40' : 'bg-white dark:bg-[#151f33]'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-1.5">
                            <span className="text-[10px] font-mono font-semibold text-slate-400 dark:text-slate-500 truncate max-w-[90px]">{p.sku}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              isOutOfStock ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500' : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {isOutOfStock ? 'Hết hàng' : `Kho: ${p.currentStock}`}
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm line-clamp-2 leading-snug">{p.name}</h4>
                          {p.shelf ? (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-800/60 px-2 py-0.5 rounded-full w-fit max-w-full truncate shadow-xs" title={`Vị trí: ${p.shelf.name}`}>
                              <MapPin size={10} className="shrink-0 text-amber-500" />
                              <span className="truncate">{p.shelf.code ? `[${p.shelf.code}] ` : ''}{p.shelf.name}</span>
                            </div>
                          ) : (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 italic">
                              Chưa xếp kệ
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                          <span className="font-extrabold text-sky-500 text-xs sm:text-sm">{formatCurrency(p.salePrice)}</span>
                          <span className="w-6 h-6 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center font-bold text-xs hover:bg-sky-400 hover:text-white transition-colors">
                            +
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Cart & Checkout Panel */}
          <div className="lg:w-5/12 card p-4 sm:p-5 flex flex-col min-h-0 bg-white dark:bg-[#151f33] border border-slate-100 dark:border-slate-800 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 text-sm sm:text-base">
                  <ShoppingCart size={18} className="text-emerald-500" />
                  Giỏ hàng ({cart.reduce((s, i) => s + i.quantity, 0)})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Wholesale / Retail Price Mode Toggle */}
                <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => handleTogglePriceMode('RETAIL')}
                    className={`px-2.5 py-1 rounded-full transition-all ${priceMode === 'RETAIL' ? 'bg-white dark:bg-[#151f33] shadow-xs text-sky-600 font-extrabold' : 'text-slate-400 hover:text-slate-600'}`}
                    title="Áp dụng giá bán lẻ"
                  >
                    Giá lẻ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePriceMode('WHOLESALE')}
                    className={`px-2.5 py-1 rounded-full transition-all flex items-center gap-1 ${priceMode === 'WHOLESALE' ? 'bg-indigo-600 shadow-xs text-white font-extrabold' : 'text-slate-400 hover:text-indigo-600'}`}
                    title="Áp dụng giá bán sỉ cho đại lý"
                  >
                    <Store size={12} /> Giá sỉ (B2B)
                  </button>
                </div>

                {cart.length > 0 && (
                  <button 
                    onClick={() => setCart([])} 
                    className="text-xs text-rose-500 hover:underline font-semibold ml-1"
                  >
                    Xóa
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 my-2 pr-1 min-h-[100px]">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 py-6">
                  <ShoppingCart size={40} className="mb-2 stroke-1 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Chưa có sản phẩm trong giỏ</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Chọn từ danh mục bên trái hoặc quét mã vạch</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm truncate">{item.name}</h5>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-slate-400 font-mono">{formatCurrency(item.price)}</span>
                        {item.isWholesalePrice && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                            Giá sỉ
                          </span>
                        )}
                        {item.shelf && (
                          <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded truncate max-w-[140px]" title={item.shelf.name}>
                            📍 {item.shelf.code ? `[${item.shelf.code}] ` : ''}{item.shelf.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity -/+ buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button 
                        onClick={() => updateCartQty(item.productId, -1)}
                        className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        max={item.maxStock}
                        className="w-10 text-center font-bold text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-lg py-1"
                        value={item.quantity}
                        onChange={(e) => setCartItemField(item.productId, 'quantity', e.target.value)}
                      />
                      <button 
                        onClick={() => updateCartQty(item.productId, 1)}
                        className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm"
                      >
                        +
                      </button>
                    </div>

                    <div className="w-24 text-right font-bold text-slate-800 dark:text-slate-100 text-xs sm:text-sm shrink-0">
                      {formatCurrency(item.quantity * item.price)}
                    </div>

                    <button 
                      onClick={() => removeCartItem(item.productId)}
                      className="text-slate-300 dark:text-slate-600 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Checkout Area */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5 shrink-0">
              {/* Customer Selector */}
              <div className="space-y-1.5">
                <div className="flex gap-2">
                  <select
                    className="input py-2 text-xs flex-1 rounded-full"
                    value={selectedCustomer}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                  >
                    <option value="">Khách lẻ (Không lưu tên)</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.customerType === 'WHOLESALE' ? '🏬 [Đại lý] ' : ''}
                        {c.storeName ? `${c.storeName} (${c.name})` : c.name} {c.phone ? `– ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setQuickCustOpen(true)}
                    className="btn-secondary py-2 px-3 text-xs shrink-0 rounded-full"
                    title="Thêm nhanh khách hàng / Đại lý mới"
                  >
                    <UserPlus size={16} />
                  </button>
                </div>

                {/* Selected customer debt badge */}
                {(() => {
                  const cust = customers.find(c => c.id === selectedCustomer);
                  if (!cust) return null;
                  const currentDebt = Number(cust.currentDebt) || 0;
                  return (
                    <div className="flex items-center justify-between text-[11px] px-2 text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-indigo-600">
                        {cust.customerType === 'WHOLESALE' ? <Store size={13} /> : null}
                        {cust.storeName || cust.name}
                      </span>
                      <span>
                        Dư nợ hiện tại: <b className={currentDebt > 0 ? 'text-rose-600' : 'text-slate-700'}>{formatCurrency(currentDebt)}</b>
                      </span>
                    </div>
                  );
                })()}
              </div>

              {/* Discount inputs */}
              <div className="flex items-center gap-2">
                <div className="flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-bold shrink-0">
                  <button 
                    onClick={() => { setDiscountType('amount'); setDiscountPercent(0); }}
                    className={`px-3 py-1 rounded-full ${discountType === 'amount' ? 'bg-white dark:bg-[#151f33] shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    VNĐ
                  </button>
                  <button 
                    onClick={() => { setDiscountType('percent'); setDiscount(0); }}
                    className={`px-3 py-1 rounded-full ${discountType === 'percent' ? 'bg-white dark:bg-[#151f33] shadow-sm text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                  >
                    %
                  </button>
                </div>
                {discountType === 'amount' ? (
                  <MoneyInput
                    placeholder="Giảm giá tiền mặt"
                    className="input py-1.5 text-xs text-right"
                    value={discount}
                    onChange={setDiscount}
                  />
                ) : (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Giảm %"
                    className="input py-1.5 text-xs text-right"
                    value={discountPercent || ''}
                    onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                  />
                )}
              </div>

              {/* Payment Method Selector */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('CASH'); setCustomerPaid(finalAmount); }}
                  className={`py-2 px-1.5 rounded-2xl border font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'CASH'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Banknote size={15} /> Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('TRANSFER'); setCustomerPaid(finalAmount); }}
                  className={`py-2 px-1.5 rounded-2xl border font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'TRANSFER'
                      ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 shadow-sm ring-1 ring-sky-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <CreditCard size={15} /> Chuyển khoản
                </button>
                <button
                  type="button"
                  onClick={() => { setPaymentMethod('DEBT'); setCustomerPaid(0); }}
                  className={`py-2 px-1.5 rounded-2xl border font-bold text-xs flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'DEBT'
                      ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 shadow-sm ring-1 ring-rose-200'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Store size={15} /> Ghi nợ tiệm
                </button>
              </div>

              {/* If Cash: Tender suggestions & change calculation */}
              {paymentMethod === 'CASH' && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-2xl space-y-2 border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Khách đưa:</span>
                    <MoneyInput
                      className="input py-1 px-3 text-right font-bold w-36 text-sm"
                      value={customerPaid}
                      onChange={setCustomerPaid}
                    />
                  </div>
                  {/* Quick tender pills */}
                  <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {[finalAmount, 50000, 100000, 200000, 500000].map((amt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCustomerPaid(amt)}
                        className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
                      >
                        {amt === finalAmount ? 'Đủ tiền' : formatCurrency(amt)}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200/50 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Tiền thối lại:</span>
                    <span className="font-bold text-emerald-500 text-sm">{formatCurrency(changeDue)}</span>
                  </div>
                </div>
              )}

              {/* If Debt: Tender advance and warning calculation */}
              {paymentMethod === 'DEBT' && (() => {
                const currentCust = customers.find(c => c.id === selectedCustomer);
                const remainingDebt = Math.max(0, finalAmount - customerPaid);
                const currentDebt = Number(currentCust?.currentDebt) || 0;
                const debtLimit = Number(currentCust?.debtLimit) || 0;
                const newTotalDebt = currentDebt + remainingDebt;
                const isExceeded = debtLimit > 0 && newTotalDebt > debtLimit;

                return (
                  <div className="bg-rose-50/60 dark:bg-rose-950/30 p-2.5 rounded-2xl space-y-2 border border-rose-200/70 dark:border-rose-900/50 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-700 dark:text-rose-400">Khách trả trước đợt này:</span>
                      <MoneyInput
                        className="input py-1 px-3 text-right font-bold w-36 text-sm"
                        value={customerPaid}
                        onChange={setCustomerPaid}
                      />
                    </div>
                    {currentCust ? (
                      <div className="space-y-1 pt-1.5 border-t border-rose-200/50 dark:border-rose-900/40">
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>Nợ phát sinh đơn này:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(remainingDebt)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500 dark:text-slate-400">
                          <span>Dư nợ cũ của tiệm:</span>
                          <span>{formatCurrency(currentDebt)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-slate-800 dark:text-slate-100 pt-1 border-t border-rose-100 dark:border-rose-900/40">
                          <span>Tổng nợ sau đơn:</span>
                          <span className="text-rose-700 dark:text-rose-400 font-black">
                            {formatCurrency(newTotalDebt)}
                          </span>
                        </div>
                        {debtLimit > 0 && (
                          <div className="pt-0.5">
                            <div className="flex justify-between text-[11px] text-slate-400">
                              <span>Hạn mức nợ cho phép:</span>
                              <span>{formatCurrency(debtLimit)}</span>
                            </div>
                            {isExceeded && (
                              <div className="mt-1.5 p-2 bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 font-semibold flex items-start gap-1.5 text-[11px]">
                                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                <span>Lưu ý: Đơn hàng sẽ khiến công nợ vượt hạn mức {formatCurrency(debtLimit)}. Vẫn có thể xác nhận chốt đơn.</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-2 bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                        <span>Chưa chọn khách hàng! Vui lòng chọn hoặc thêm Đại lý / Khách hàng bên trên để ghi nợ.</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Summary Totals */}
              <div className="space-y-1 text-xs pt-1">
                <div className="flex justify-between text-slate-500 dark:text-slate-400">
                  <span>Tổng tiền hàng:</span>
                  <span className="text-slate-700 dark:text-slate-200 font-semibold">{formatCurrency(totalAmount)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-rose-500">
                    <span>Giảm giá:</span>
                    <span>-{formatCurrency(calculatedDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">KHÁCH PHẢI TRẢ:</span>
                  <span className="font-extrabold text-emerald-500 text-xl">{formatCurrency(finalAmount)}</span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0}
                className="w-full btn-success py-3 text-sm font-extrabold tracking-wide rounded-full shadow-md shadow-emerald-500/25"
              >
                {submitting ? 'ĐANG THANH TOÁN...' : 'THANH TOÁN & IN HÓA ĐƠN (F9)'}
              </button>
            </div>
          </div>
        </div>

        {/* Camera Scanner */}
        {showScanner && (
          <CameraScanner
            onScan={(code) => {
              const exact = products.find(p => p.sku.toLowerCase() === code.trim().toLowerCase());
              if (exact) {
                handleAddToCart(exact);
                toast.success(`Đã thêm ${exact.name} vào giỏ`);
              } else {
                toast.warning(`Không tìm thấy sản phẩm với mã: ${code}`);
              }
            }}
            onClose={() => setShowScanner(false)}
          />
        )}

        {/* Quick Add Customer Modal */}
        <Modal
          open={quickCustOpen}
          onClose={() => setQuickCustOpen(false)}
          title="Thêm nhanh khách hàng / Đại lý"
          icon={<UserPlus size={18} className="text-sky-500" />}
          footer={
            <>
              <button type="button" onClick={() => setQuickCustOpen(false)} className="btn-secondary">Hủy</button>
              <button type="submit" form="quick-cust-form" disabled={quickCustSaving} className="btn-primary">
                {quickCustSaving ? 'Đang lưu...' : 'Lưu & Chọn'}
              </button>
            </>
          }
        >
          <form id="quick-cust-form" onSubmit={handleQuickCreateCustomer} className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQuickCustForm({ ...quickCustForm, customerType: 'RETAIL' })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${quickCustForm.customerType === 'RETAIL' ? 'border-sky-500 bg-sky-50 text-sky-700 ring-1 ring-sky-200' : 'border-slate-200 text-slate-600'}`}
              >
                Khách lẻ
              </button>
              <button
                type="button"
                onClick={() => setQuickCustForm({ ...quickCustForm, customerType: 'WHOLESALE' })}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${quickCustForm.customerType === 'WHOLESALE' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200' : 'border-slate-200 text-slate-600'}`}
              >
                Đại lý / Tiệm sỉ
              </button>
            </div>
            <div>
              <label className="label">Tên người đại diện / Khách hàng *</label>
              <input
                type="text"
                required
                autoFocus
                className="input"
                placeholder="VD: Anh Minh..."
                value={quickCustForm.name}
                onChange={(e) => setQuickCustForm({ ...quickCustForm, name: e.target.value })}
              />
            </div>
            {quickCustForm.customerType === 'WHOLESALE' && (
              <div>
                <label className="label">Tên cửa hàng / Tiệm tạp hóa</label>
                <input
                  type="text"
                  className="input"
                  placeholder="VD: Tạp hóa Hoàng Phát..."
                  value={quickCustForm.storeName}
                  onChange={(e) => setQuickCustForm({ ...quickCustForm, storeName: e.target.value })}
                />
              </div>
            )}
            <div>
              <label className="label">Số điện thoại</label>
              <input
                type="tel"
                className="input"
                placeholder="0912 345 678"
                value={quickCustForm.phone}
                onChange={(e) => setQuickCustForm({ ...quickCustForm, phone: e.target.value })}
              />
            </div>
            {quickCustForm.customerType === 'WHOLESALE' && (
              <div>
                <label className="label">Hạn mức nợ cho phép (VNĐ)</label>
                <MoneyInput
                  value={quickCustForm.debtLimit}
                  onChange={(val) => setQuickCustForm({ ...quickCustForm, debtLimit: val })}
                  placeholder="0 (Không giới hạn)"
                />
              </div>
            )}
          </form>
        </Modal>
      </div>
    );
  }

  // ==========================================
  // LIST VIEW (LỊCH SỬ HÓA ĐƠN)
  // ==========================================
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Store}
        color="emerald"
        title="Lịch sử hóa đơn bán"
        subtitle="Quản lý danh sách các giao dịch bán hàng, xem chi tiết, in lại bill hoặc hủy đơn"
        actions={
          <button onClick={() => setView('pos')} className="btn-success">
            <ShoppingCart size={18} /> Bán hàng (POS)
          </button>
        }
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Tìm mã đơn, tên khách..."
              className="input pl-10"
              value={filterSearch}
              onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
            />
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
        ) : sales.length === 0 ? (
          <EmptyState
            icon={Store}
            title="Chưa có hóa đơn bán nào"
            description="Bắt đầu tạo đơn bán hàng đầu tiên để hệ thống tự động ghi nhận doanh thu và trừ tồn kho."
            action={
              <button onClick={() => setView('pos')} className="btn-success">
                <ShoppingCart size={16} /> Mở POS Bán hàng
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="th">Mã hóa đơn</th>
                  <th className="th">Thời gian</th>
                  <th className="th">Khách hàng</th>
                  <th className="th">Hình thức</th>
                  <th className="th">Trạng thái</th>
                  <th className="th text-right">Tổng tiền</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="td font-bold text-emerald-500 font-mono">
                      {s.code}
                    </td>
                    <td className="td text-slate-500 dark:text-slate-400 text-xs">
                      {formatDate(s.createdAt)}
                    </td>
                    <td className="td font-semibold text-slate-800 dark:text-slate-100">
                      {s.customer?.name || 'Khách lẻ'}
                    </td>
                    <td className="td text-slate-600 dark:text-slate-300 text-xs">
                      {PAYMENT_LABELS[s.paymentMethod] || s.paymentMethod}
                    </td>
                    <td className="td">
                      <span className={`chip ${
                        s.status === 'CANCELLED' 
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500' 
                          : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500'
                      }`}>
                        {s.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn thành'}
                      </span>
                    </td>
                    <td className="td text-right font-extrabold text-slate-800 dark:text-slate-100">
                      {formatCurrency(s.finalAmount)}
                    </td>
                    <td className="td text-right space-x-1">
                      <button
                        onClick={() => handleViewDetail(s.id)}
                        className="icon-btn text-sky-500 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                        title="Xem chi tiết hóa đơn"
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        onClick={async () => {
                          const res = await api.get(`/sales/${s.id}`);
                          printReceipt(res.data.data, settings);
                        }}
                        className="icon-btn text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        title="In lại hóa đơn"
                      >
                        <Printer size={17} />
                      </button>
                      {s.status !== 'CANCELLED' && (
                        <button
                          onClick={() => handleCancelSale(s)}
                          className="icon-btn text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Hủy hóa đơn (Hoàn tồn kho)"
                        >
                          <Ban size={17} />
                        </button>
                      )}
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
        title={`Chi tiết hóa đơn: ${detailSale?.code || ''}`}
        icon={<Store size={20} className="text-emerald-500" />}
        size="lg"
        footer={
          detailSale && (
            <div className="flex justify-between items-center w-full">
              {detailSale.status !== 'CANCELLED' ? (
                <button
                  onClick={() => handleCancelSale(detailSale)}
                  className="btn-danger text-xs py-2"
                >
                  <Ban size={15} /> Hủy hóa đơn này
                </button>
              ) : <div />}
              <div className="flex gap-2">
                <button onClick={() => setDetailOpen(false)} className="btn-secondary">Đóng</button>
                <button 
                  onClick={() => printDeliveryNote(detailSale, settings)} 
                  className="btn-secondary text-xs flex items-center gap-1.5 border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                  title="In Phiếu Giao Hàng A4/A5 cho đại lý"
                >
                  <FileText size={16} /> Phiếu Giao Hàng (B2B)
                </button>
                <button 
                  onClick={() => printReceipt(detailSale, settings)} 
                  className="btn-primary text-xs flex items-center gap-1.5"
                  title="In hóa đơn cuộn nhiệt K80"
                >
                  <Printer size={16} /> Bill K80
                </button>
              </div>
            </div>
          )
        }
      >
        {detailLoading ? (
          <SkeletonRows rows={5} cols={4} />
        ) : detailSale && (
          <div className="space-y-4">
            {/* Header info card */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="text-slate-400">Thời gian:</span>
                <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{formatDate(detailSale.createdAt)}</p>
              </div>
              <div>
                <span className="text-slate-400">Khách hàng:</span>
                <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{detailSale.customer?.name || 'Khách lẻ'}</p>
                {detailSale.customer?.storeName && (
                  <p className="text-[11px] text-indigo-600 font-semibold">{detailSale.customer.storeName}</p>
                )}
              </div>
              <div>
                <span className="text-slate-400">Hình thức:</span>
                <p className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">{PAYMENT_LABELS[detailSale.paymentMethod]}</p>
              </div>
              <div>
                <span className="text-slate-400">Trạng thái:</span>
                <p className={`font-bold mt-0.5 ${detailSale.status === 'CANCELLED' ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {detailSale.status === 'CANCELLED' ? 'ĐÃ HỦY' : 'HOÀN THÀNH'}
                </p>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-xs">
                  <th className="py-2">Sản phẩm</th>
                  <th className="py-2 text-center">SL</th>
                  <th className="py-2 text-right">Đơn giá</th>
                  <th className="py-2 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {detailSale.items?.map((it) => (
                  <tr key={it.id}>
                    <td className="py-2.5">
                      <p className="font-bold text-slate-800 dark:text-slate-100">{it.product?.name}</p>
                      <p className="text-xs text-slate-400">{it.product?.sku}</p>
                    </td>
                    <td className="py-2.5 text-center font-bold text-slate-700 dark:text-slate-200">{it.quantity}</td>
                    <td className="py-2.5 text-right text-slate-600 dark:text-slate-300">{formatCurrency(it.price)}</td>
                    <td className="py-2.5 text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(it.quantity * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5 text-sm text-right">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tổng tiền hàng:</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">{formatCurrency(detailSale.totalAmount)}</span>
              </div>
              {Number(detailSale.discount) > 0 && (
                <div className="flex justify-between text-rose-500">
                  <span>Giảm giá:</span>
                  <span>-{formatCurrency(detailSale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-extrabold text-base text-slate-800 dark:text-slate-100 pt-1 border-t border-slate-200 dark:border-slate-800">
                <span>Khách cần trả:</span>
                <span className="text-emerald-500 text-lg">{formatCurrency(detailSale.finalAmount)}</span>
              </div>
              {detailSale.customerPaid !== undefined && (
                <div className="flex justify-between text-xs text-slate-500 pt-1">
                  <span>Khách đã trả:</span>
                  <span className="font-bold text-slate-700">{formatCurrency(detailSale.customerPaid)}</span>
                </div>
              )}
              {Number(detailSale.finalAmount) > Number(detailSale.customerPaid || 0) && (
                <div className="flex justify-between text-xs text-rose-600 font-bold pt-0.5">
                  <span>Ghi nợ đơn này:</span>
                  <span>{formatCurrency(Number(detailSale.finalAmount) - Number(detailSale.customerPaid || 0))}</span>
                </div>
              )}
            </div>

            {detailSale.note && (
              <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-2xl border border-amber-100 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-bold">Ghi chú:</span> {detailSale.note}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal Hoàn tất Đơn hàng & Lựa chọn Mẫu In (Thermal Bill vs B2B Delivery Note) */}
      <Modal
        open={successModalOpen}
        onClose={() => { setSuccessModalOpen(false); setCompletedSale(null); }}
        title="Thanh toán đơn hàng thành công!"
        icon={<CheckCircle size={22} className="text-emerald-500" />}
        footer={
          <button
            onClick={() => { setSuccessModalOpen(false); setCompletedSale(null); }}
            className="btn-primary w-full sm:w-auto"
          >
            Tạo đơn hàng mới (Đóng)
          </button>
        }
      >
        {completedSale && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-semibold">Mã hóa đơn</p>
                <p className="font-mono font-black text-lg text-emerald-800">{completedSale.code}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Khách: <b>{completedSale.customer?.storeName ? `[${completedSale.customer.storeName}] ${completedSale.customer.name}` : (completedSale.customer?.name || 'Khách lẻ')}</b>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-emerald-600 font-semibold">Tổng thanh toán</p>
                <p className="font-black text-xl text-emerald-700">{formatCurrency(completedSale.finalAmount)}</p>
                <span className="inline-block mt-1 chip bg-white text-emerald-700 font-bold border border-emerald-200">
                  {PAYMENT_LABELS[completedSale.paymentMethod] || completedSale.paymentMethod}
                </span>
              </div>
            </div>

            {completedWarning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2 text-xs text-amber-800">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Lưu ý: Công nợ vượt hạn mức</p>
                  <p className="text-amber-700 mt-0.5">
                    Đơn hàng ghi nợ khiến công nợ đạt {formatCurrency(completedWarning.balanceAfter)}, vượt hạn mức {formatCurrency(completedWarning.debtLimit)}.
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chọn mẫu in phiếu xuất:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => printReceipt(completedSale, settings)}
                className="p-4 rounded-2xl border-2 border-slate-200 hover:border-sky-500 hover:bg-sky-50/50 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Printer size={24} />
                </div>
                <span className="font-bold text-sm text-slate-800">In Hóa đơn nhiệt K80</span>
                <span className="text-xs text-slate-400 mt-0.5">Khổ cuộn 80mm cho quầy bán lẻ</span>
              </button>

              <button
                type="button"
                onClick={() => printDeliveryNote(completedSale, settings)}
                className="p-4 rounded-2xl border-2 border-indigo-200 hover:border-indigo-600 hover:bg-indigo-50/50 flex flex-col items-center justify-center text-center transition-all group"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <span className="font-bold text-sm text-indigo-900">In Phiếu Giao Hàng A4/A5</span>
                <span className="text-xs text-indigo-500 mt-0.5">Kèm nợ cũ, nợ mới & chữ ký 3 bên</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Sales;
