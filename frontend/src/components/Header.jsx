import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, ScanBarcode, FileText, Bell, ChevronDown, Menu, LogOut, 
  Settings, User as UserIcon, X, ShoppingCart, Truck, PackagePlus, 
  Plus, Moon, Sun, AlertTriangle, ArrowRight, Package, Users
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';
import CameraScanner from './CameraScanner';
import api from '../services/api';
import { formatCurrency } from '../utils/format';

const Header = ({ sidebarOpen, setSidebarOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { settings } = useStore();
  const { dark, toggle: toggleTheme } = useTheme();
  const { toast } = useToast();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  // Low stock notifications
  const [lowStockList, setLowStockList] = useState([]);

  // States for Global Scanner Actions
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scannedSku, setScannedSku] = useState(null);

  const fetchLowStock = async () => {
    try {
      const res = await api.get('/analytics/low-stock');
      setLowStockList(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 60000);
    return () => clearInterval(interval);
  }, []);

  // Global search effect
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await api.get(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchResults(res.data.data);
        setShowSearchDropdown(true);
      } catch (err) {
        console.error(err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGlobalScan = async (decodedText) => {
    setShowScanner(false);
    try {
      const sku = decodedText.trim();
      const res = await api.get(`/products/sku/${encodeURIComponent(sku)}`).catch(() => null);
      
      if (res && res.data?.data) {
        setScannedProduct(res.data.data);
      } else {
        setScannedSku(sku);
      }
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi tra cứu mã vạch');
    }
  };

  return (
    <header className="flex items-center justify-between px-6 md:px-8 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-white/90 dark:bg-[#0e1726]/90 backdrop-blur-md sticky top-0 z-30 transition-colors">
      {/* Search Bar & Hamburger */}
      <div className="flex-1 max-w-xl relative flex items-center gap-3">
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
          title="Thu gọn / Mở rộng menu"
        >
          <Menu size={22} />
        </button>

        <div className="relative flex-1" ref={searchRef}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Tìm sản phẩm, hóa đơn, khách hàng..." 
            className="w-full bg-slate-50 dark:bg-[#151f33] border border-slate-200 dark:border-slate-700 rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => { if (searchResults) setShowSearchDropdown(true); }}
          />

          {/* Search Dropdown Results */}
          {showSearchDropdown && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151f33] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-3 z-50 max-h-96 overflow-y-auto animate-pop-in">
              {searchLoading ? (
                <div className="p-4 text-center text-xs text-slate-400">Đang tìm kiếm...</div>
              ) : (searchResults.products.length === 0 && searchResults.sales.length === 0 && searchResults.customers.length === 0) ? (
                <div className="p-4 text-center text-sm text-slate-400">Không tìm thấy kết quả phù hợp</div>
              ) : (
                <div className="space-y-3">
                  {/* Sản phẩm */}
                  {searchResults.products.length > 0 && (
                    <div>
                      <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Package size={13} /> Sản phẩm
                      </div>
                      {searchResults.products.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            navigate(`/products?search=${encodeURIComponent(p.sku)}`);
                          }}
                          className="px-4 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.name}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 flex-wrap">
                              <span>SKU: {p.sku}</span>
                              <span>·</span>
                              <span>Kho: {p.currentStock}</span>
                              {p.shelf && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">📍 {p.shelf.code ? `[${p.shelf.code}] ` : ''}{p.shelf.name}</span>
                                </>
                              )}
                            </p>
                          </div>
                          <span className="text-xs font-bold text-sky-600">{formatCurrency(p.salePrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Hóa đơn */}
                  {searchResults.sales.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText size={13} /> Hóa đơn
                      </div>
                      {searchResults.sales.map(s => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            navigate(`/sales?search=${encodeURIComponent(s.code)}`);
                          }}
                          className="px-4 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-semibold text-emerald-600">{s.code}</p>
                            <p className="text-xs text-slate-400">{new Date(s.createdAt).toLocaleDateString('vi-VN')}</p>
                          </div>
                          <span className="text-xs font-bold text-slate-800">{formatCurrency(s.finalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Khách hàng */}
                  {searchResults.customers.length > 0 && (
                    <div className="border-t border-slate-100 pt-2">
                      <div className="px-4 py-1 text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Users size={13} /> Khách hàng
                      </div>
                      {searchResults.customers.map(c => (
                        <div
                          key={c.id}
                          onClick={() => {
                            setShowSearchDropdown(false);
                            navigate(`/customers?search=${encodeURIComponent(c.phone || c.name)}`);
                          }}
                          className="px-4 py-2 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.phone || 'Chưa có SĐT'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons & Profile */}
      <div className="flex items-center gap-3 ml-4">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          title={dark ? 'Chuyển giao diện sáng' : 'Chuyển giao diện tối'}
        >
          {dark ? <Sun size={19} className="text-amber-400" /> : <Moon size={19} />}
        </button>

        {/* Global Barcode Scanner */}
        <button 
          onClick={() => setShowScanner(true)}
          className="flex items-center gap-2 bg-sky-400 hover:bg-sky-500 text-white px-4 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm shadow-sky-400/25"
          title="Quét mã vạch Camera"
        >
          <ScanBarcode size={18} />
          <span className="hidden md:inline">Quét mã</span>
        </button>
        
        {/* Quick Sale / Create Bill (Restored to original white pill design) */}
        <button 
          onClick={() => navigate('/sales?mode=pos')}
          className="flex items-center gap-2 bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 px-4 py-2.5 rounded-full text-sm font-medium transition-colors shadow-sm hidden sm:flex"
        >
          <FileText size={18} />
          <span>Tạo hóa đơn</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotif(!showNotif)}
            className="p-2.5 bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-700 rounded-full hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors relative shadow-sm"
            title="Thông báo hàng sắp hết"
          >
            <Bell size={19} />
            {lowStockList.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-[#151f33]">
                {lowStockList.length > 9 ? '9+' : lowStockList.length}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute top-full right-0 mt-3 w-80 bg-white dark:bg-[#151f33] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-3 z-50 animate-pop-in">
              <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-amber-500" /> Cảnh báo tồn kho
                </span>
                <span className="text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">
                  {lowStockList.length} sản phẩm
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
                {lowStockList.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Kho hàng ổn định, chưa có sản phẩm nào chạm ngưỡng tối thiểu.
                  </div>
                ) : (
                  lowStockList.map(item => (
                    <div 
                      key={item.id} 
                      onClick={() => { setShowNotif(false); navigate('/inventory'); }}
                      className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{item.name}</p>
                        <p className="text-xs text-slate-400">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full">
                          Còn {item.currentStock}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">Tối thiểu: {item.minStock}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {lowStockList.length > 0 && (
                <div className="p-2 border-t border-slate-100 dark:border-slate-800 text-center">
                  <button 
                    onClick={() => { setShowNotif(false); navigate('/inventory'); }}
                    className="text-xs text-sky-500 hover:text-sky-600 font-semibold flex items-center justify-center gap-1 w-full py-1"
                  >
                    Xem chi tiết kho hàng <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative" ref={userMenuRef}>
          <div 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 pl-2 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 bg-sky-100 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center font-bold group-hover:border-sky-300 transition-colors uppercase text-sm">
              {user?.name?.substring(0, 2) || 'AD'}
            </div>
            <div className="hidden lg:block text-left">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{user?.name || 'Chủ cửa hàng'}</p>
              <p className="text-xs text-slate-400 truncate max-w-[120px]">
                {settings?.storeName || 'Quản trị viên'}
              </p>
            </div>
            <ChevronDown size={15} className={`text-slate-400 group-hover:text-slate-600 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
          </div>

          {showUserMenu && (
            <div className="absolute top-full right-0 mt-3 w-56 bg-white dark:bg-[#151f33] rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 py-2 z-50 animate-pop-in">
              <div className="px-4 py-2 border-b border-slate-50 dark:border-slate-800 mb-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
              </div>
              <button onClick={() => { setShowUserMenu(false); navigate('/settings?tab=profile'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-sky-500 transition-colors text-left">
                <UserIcon size={16} /> Hồ sơ cá nhân
              </button>
              <button onClick={() => { setShowUserMenu(false); navigate('/settings?tab=store'); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-sky-500 transition-colors text-left">
                <Settings size={16} /> Cài đặt cửa hàng
              </button>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1"></div>
              <button 
                onClick={logout} 
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left font-medium"
              >
                <LogOut size={16} /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>

      {showScanner && (
        <CameraScanner 
          onScan={handleGlobalScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Global Scanner Action Modals */}
      {scannedProduct && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#151f33] rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl border border-slate-100 dark:border-slate-800 animate-pop-in">
            <button onClick={() => setScannedProduct(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20}/></button>
            <div className="w-16 h-16 bg-sky-100 dark:bg-sky-950/60 text-sky-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ScanBarcode size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Đã tìm thấy sản phẩm</h3>
            <p className="text-slate-700 dark:text-slate-200 font-semibold mb-1">{scannedProduct.name}</p>
            <p className="text-sm text-slate-400 mb-6">SKU: {scannedProduct.sku} · Tồn kho: <span className="font-bold text-slate-700 dark:text-slate-200">{scannedProduct.currentStock}</span></p>
            
            <div className="space-y-3">
              <button 
                onClick={() => { setScannedProduct(null); navigate(`/sales?action=add&sku=${scannedProduct.sku}`); }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-2xl font-bold shadow-md shadow-emerald-500/25 transition-all"
              >
                <ShoppingCart size={18} /> Bán hàng ngay
              </button>
              <button 
                onClick={() => { setScannedProduct(null); navigate(`/purchases?action=add&sku=${scannedProduct.sku}`); }}
                className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-2xl font-bold shadow-md shadow-sky-500/25 transition-all"
              >
                <Truck size={18} /> Nhập thêm hàng
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {scannedSku && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#151f33] rounded-3xl p-6 w-full max-w-sm text-center relative shadow-2xl border border-slate-100 dark:border-slate-800 animate-pop-in">
            <button onClick={() => setScannedSku(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20}/></button>
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <PackagePlus size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Sản phẩm mới!</h3>
            <p className="text-slate-500 text-sm mb-3">Mã vạch này chưa có trong danh mục sản phẩm.</p>
            <p className="text-sm font-mono font-bold text-slate-800 dark:text-slate-100 mb-6 bg-slate-100 dark:bg-slate-800 py-2 rounded-xl">{scannedSku}</p>
            
            <button 
              onClick={() => { setScannedSku(null); navigate(`/products?action=create&sku=${scannedSku}`); }}
              className="w-full flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 text-white py-3 rounded-2xl font-bold shadow-md shadow-sky-500/25 transition-all"
            >
              <Plus size={18} /> Tạo sản phẩm mới
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};

export default Header;
