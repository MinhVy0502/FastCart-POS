import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Box, 
  Tags, 
  Layers,
  Package, 
  Truck, 
  ShoppingCart, 
  Users, 
  Building2,
  FileText, 
  Settings, 
  LogOut,
  ChevronRight,
  Store
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const { logout } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  
  const menuItems = [
    { name: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Bán hàng (POS)', path: '/sales', icon: ShoppingCart },
    { name: 'Sản phẩm', path: '/products', icon: Package },
    { name: 'Danh mục', path: '/categories', icon: Tags },
    { name: 'Kệ hàng', path: '/shelves', icon: Layers },
    { name: 'Kho hàng', path: '/inventory', icon: Box },
    { name: 'Nhập hàng', path: '/purchases', icon: Truck },
    { name: 'Khách hàng', path: '/customers', icon: Users },
    { name: 'Nhà cung cấp', path: '/suppliers', icon: Building2 },
    { name: 'Báo cáo', path: '/reports', icon: FileText },
  ];

  const handleNavClick = () => {
    // Tự động thu gọn sidebar trên màn hình nhỏ
    if (window.innerWidth < 768) {
      setIsOpen?.(false);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden animate-fade-in"
          onClick={() => setIsOpen?.(false)}
        />
      )}

      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        h-full bg-slate-50 dark:bg-[#0c1322] flex flex-col border-r border-slate-200 dark:border-slate-800/80 transition-all duration-300
        ${isOpen ? 'w-64 translate-x-0' : '-translate-x-full md:translate-x-0 md:w-0 md:border-none md:overflow-hidden'}
      `}>
        {/* Logo Area */}
        <div className="flex items-center justify-between p-6 pb-2 min-w-[256px]">
          <div className="flex items-center gap-2.5 text-sky-500 font-extrabold text-xl tracking-tight">
            <div className="w-10 h-10 rounded-2xl bg-sky-400 text-white flex items-center justify-center shadow-md shadow-sky-400/30">
              <ShoppingCart size={22} className="stroke-[2.5]" />
            </div>
            <span className="text-slate-800 dark:text-slate-100">Fast<span className="text-sky-400">Cart</span></span>
          </div>
        </div>

        {/* Store Card / Selector */}
        <div className="px-4 py-3 min-w-[256px]">
          <div 
            onClick={() => { navigate('/settings?tab=store'); handleNavClick(); }}
            className="bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex justify-between items-center cursor-pointer shadow-sm hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-md transition-all group"
            title="Bấm để xem/sửa thông tin cửa hàng"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center shrink-0">
                <Store size={18} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-500 transition-colors">
                  {settings?.storeName || 'Cửa hàng của tôi'}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-400 truncate">
                  {settings?.phone || settings?.address || 'Quản lý cửa hàng'}
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 min-w-[256px] scrollbar-hide">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-semibold text-sm ${
                    isActive
                      ? 'bg-sky-400 text-white shadow-md shadow-sky-400/30'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                  }`
                }
              >
                <Icon size={19} className="stroke-[2]" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Nav */}
        <div className="px-4 py-4 space-y-1 border-t border-slate-200 dark:border-slate-800/80 min-w-[256px]">
          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-colors font-semibold text-sm ${
                isActive ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-500' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
              }`
            }
          >
            <Settings size={19} className="stroke-[2]" />
            Cài đặt
          </NavLink>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl transition-colors font-semibold text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
          >
            <LogOut size={19} className="stroke-[2]" />
            Đăng xuất
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
