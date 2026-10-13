const fs = require('fs');
const path = require('path');

const pages = [
  { name: 'Dashboard', title: 'Tổng quan hệ thống', icon: 'LayoutDashboard' },
  { name: 'Categories', title: 'Quản lý danh mục', icon: 'Tags' },
  { name: 'Products', title: 'Danh sách sản phẩm', icon: 'Package' },
  { name: 'Purchases', title: 'Đơn nhập hàng', icon: 'Truck' },
  { name: 'Sales', title: 'Bán hàng (POS)', icon: 'ShoppingCart' },
  { name: 'Customers', title: 'Khách hàng', icon: 'Users' },
  { name: 'Suppliers', title: 'Nhà cung cấp', icon: 'Building2' },
  { name: 'Reports', title: 'Báo cáo & Thống kê', icon: 'FileText' },
  { name: 'Settings', title: 'Cài đặt hệ thống', icon: 'Settings' }
];

const template = (name, title, icon) => `import { ${icon}, Plus } from 'lucide-react';

const ${name} = () => {
  return (
    <div className="h-full flex flex-col gap-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex-1 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center">
               <${icon} size={20} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">${title}</h2>
          </div>
          <button className="bg-sky-400 hover:bg-sky-500 text-white px-5 py-2.5 rounded-full text-sm font-medium shadow-md shadow-sky-400/20 flex items-center gap-2 transition-all">
            <Plus size={18} />
            Thêm mới
          </button>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4">
          <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center">
             <${icon} size={40} className="text-slate-300" />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-slate-700 mb-1">Chưa có dữ liệu</p>
            <p className="text-sm text-slate-500">Khu vực này hiện tại chưa có thông tin nào.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ${name};
`;

pages.forEach(p => {
  fs.writeFileSync(path.join('e:/DaiLyBanLe/frontend/src/pages', p.name + '.jsx'), template(p.name, p.title, p.icon));
});
console.log('Pages generated!');
