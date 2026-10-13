import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  Package, Plus, Edit2, Trash2, X, AlertCircle, Search, 
  Filter, Download, Upload, Barcode, Image as ImageIcon, CheckCircle2,
  MapPin, Layers
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useStore } from '../contexts/StoreContext';
import { PageHeader, Modal, MoneyInput, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatCurrency, getErrorMessage } from '../utils/format';
import { printBarcodeLabels } from '../utils/print';

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  const location = useLocation();
  const navigate = useNavigate();
  const { toast, confirm } = useToast();
  const { settings } = useStore();

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterShelf, setFilterShelf] = useState('');
  const [page, setPage] = useState(1);

  // Modal & Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    sku: '', name: '', categoryId: '', shelfId: '', importPrice: 0, salePrice: 0, minStock: 10, imageUrl: ''
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Barcode Print Modal
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);
  const [barcodeCopies, setBarcodeCopies] = useState(6);
  const [barcodeLayout, setBarcodeLayout] = useState('a4'); // 'a4' | 'roll'

  // Excel file input ref
  const excelInputRef = useRef(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterCategory) params.append('categoryId', filterCategory);
      if (filterShelf) params.append('shelfId', filterShelf);
      
      const res = await api.get(`/products?${params.toString()}`);
      setProducts(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách sản phẩm'));
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoriesAndShelves = async () => {
    try {
      const [catRes, shelfRes] = await Promise.all([
        api.get('/categories'),
        api.get('/shelves')
      ]);
      setCategories(catRes.data.data || []);
      setShelves(shelfRes.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCategoriesAndShelves();
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filterCategory, filterShelf, page]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const sku = params.get('sku');
    
    if (action === 'create' && sku) {
      setFormData(prev => ({ ...prev, sku: sku.toUpperCase() }));
      setEditingId(null);
      setShowModal(true);
      navigate('/products', { replace: true });
    }
  }, [location.search, navigate]);

  const openModal = (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId || '',
        shelfId: product.shelfId || '',
        importPrice: Number(product.importPrice) || 0,
        salePrice: Number(product.salePrice) || 0,
        minStock: product.minStock || 10,
        imageUrl: product.imageUrl || ''
      });
    } else {
      setEditingId(null);
      setFormData({ sku: '', name: '', categoryId: '', shelfId: '', importPrice: 0, salePrice: 0, minStock: 10, imageUrl: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      setUploadingImage(true);
      const res = await api.post('/uploads/image', body, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFormData(prev => ({ ...prev, imageUrl: res.data.data.url }));
      toast.success('Tải ảnh lên thành công');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Tải ảnh thất bại'));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.sku.trim() || !formData.name.trim()) {
      return toast.warning('Mã SKU và Tên sản phẩm là bắt buộc');
    }
    try {
      setSaving(true);
      const payload = { 
        ...formData, 
        categoryId: formData.categoryId || null,
        shelfId: formData.shelfId || null
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('Cập nhật sản phẩm thành công');
      } else {
        await api.post('/products', payload);
        toast.success('Thêm sản phẩm mới thành công');
      }
      closeModal();
      fetchProducts();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lưu sản phẩm thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p) => {
    const ok = await confirm({
      title: 'Xóa sản phẩm?',
      message: `Bạn có chắc muốn xóa "${p.name}"? Chỉ có thể xóa nếu sản phẩm chưa từng phát sinh hóa đơn bán hoặc phiếu nhập.`,
      danger: true,
      confirmText: 'Xóa vĩnh viễn'
    });
    if (!ok) return;

    try {
      await api.delete(`/products/${p.id}`);
      toast.success('Đã xóa sản phẩm');
      fetchProducts();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Xóa thất bại'));
    }
  };

  // Export products to Excel
  const handleExportExcel = () => {
    if (products.length === 0) return toast.warning('Chưa có sản phẩm để xuất file');
    const rows = products.map(p => ({
      'Mã SKU': p.sku,
      'Tên sản phẩm': p.name,
      'Danh mục': p.category?.name || '',
      'Kệ hàng': p.shelf ? (p.shelf.code ? `[${p.shelf.code}] ${p.shelf.name}` : p.shelf.name) : '',
      'Giá nhập': Number(p.importPrice) || 0,
      'Giá bán': Number(p.salePrice) || 0,
      'Tồn kho': p.currentStock || 0,
      'Mức tối thiểu': p.minStock || 0
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
    XLSX.writeFile(wb, `Danh_sach_san_pham_${Date.now()}.xlsx`);
    toast.success('Đã xuất file Excel thành công!');
  };

  // Import products from Excel
  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(wb.Sheets[wsname]);

        if (data.length === 0) return toast.warning('File Excel không có dữ liệu');

        // Map column names
        const rows = data.map(r => ({
          sku: r['Mã SKU'] || r['SKU'] || r['sku'] || r['Mã'] || '',
          name: r['Tên sản phẩm'] || r['Tên'] || r['name'] || '',
          category: r['Danh mục'] || r['category'] || '',
          importPrice: r['Giá nhập'] || r['importPrice'] || 0,
          salePrice: r['Giá bán'] || r['salePrice'] || 0,
          currentStock: r['Tồn kho'] || r['currentStock'] || 0,
          minStock: r['Mức tối thiểu'] || r['minStock'] || 10
        }));

        const res = await api.post('/products/import', { rows });
        toast.success(res.data.message || 'Nhập Excel thành công');
        fetchProducts();
      } catch (err) {
        toast.error(getErrorMessage(err, 'Lỗi đọc file Excel'));
      } finally {
        if (excelInputRef.current) excelInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  // Barcode Print Action
  const handlePrintBarcodes = () => {
    if (!selectedProductForBarcode) return;
    printBarcodeLabels(
      [{ product: selectedProductForBarcode, copies: Number(barcodeCopies) }],
      { layout: barcodeLayout, storeName: settings?.storeName || '' }
    );
    setBarcodeModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        color="sky"
        title="Danh mục sản phẩm"
        subtitle="Quản lý thông tin mặt hàng, giá nhập, giá bán và in tem nhãn mã vạch"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="file"
              ref={excelInputRef}
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleImportExcel}
            />
            <button
              onClick={() => excelInputRef.current?.click()}
              className="btn-secondary text-xs sm:text-sm"
              title="Nhập danh sách từ Excel"
            >
              <Upload size={16} /> Nhập Excel
            </button>
            <button
              onClick={handleExportExcel}
              className="btn-secondary text-xs sm:text-sm"
              title="Xuất danh sách ra file Excel"
            >
              <Download size={16} /> Xuất Excel
            </button>
            <button onClick={() => openModal()} className="btn-primary">
              <Plus size={18} /> Thêm sản phẩm
            </button>
          </div>
        }
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {/* Toolbar: Search & Category filter */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Tìm theo tên sản phẩm hoặc mã SKU..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <select
              className="input w-full sm:w-44 text-xs sm:text-sm"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select
              className="input w-full sm:w-44 text-xs sm:text-sm"
              value={filterShelf}
              onChange={(e) => { setFilterShelf(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả kệ hàng</option>
              {shelves.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code ? `[${s.code}] ` : ''}{s.name}
                </option>
              ))}
            </select>

            <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden sm:inline">
              {pagination?.total ? `Tổng ${pagination.total} SP` : ''}
            </span>
          </div>
        </div>

        {/* Products Table or Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : products.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Chưa tìm thấy sản phẩm nào"
            description="Thêm sản phẩm mới hoặc nhập nhanh danh sách từ file Excel có sẵn."
            action={
              <button onClick={() => openModal()} className="btn-primary">
                <Plus size={16} /> Thêm sản phẩm mới
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="th">Mã SKU</th>
                  <th className="th">Tên sản phẩm</th>
                  <th className="th">Danh mục & Kệ</th>
                  <th className="th text-right">Giá nhập</th>
                  <th className="th text-right">Giá bán</th>
                  <th className="th text-center">Tỷ suất lãi</th>
                  <th className="th text-center">Tồn kho</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {products.map((p) => {
                  const profit = (Number(p.salePrice) || 0) - (Number(p.importPrice) || 0);
                  const marginPercent = Number(p.importPrice) > 0 ? Math.round((profit / Number(p.importPrice)) * 100) : 0;
                  const isLowStock = p.currentStock <= p.minStock;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="td font-mono font-bold text-slate-600 text-xs">
                        {p.sku}
                      </td>
                      <td className="td font-bold text-slate-800">
                        <div className="flex items-center gap-3">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-9 h-9 rounded-xl object-cover border border-slate-200" />
                          ) : (
                            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0">
                              <Package size={18} />
                            </div>
                          )}
                          <span className="line-clamp-1">{p.name}</span>
                        </div>
                      </td>
                      <td className="td text-slate-500 text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          {p.category ? (
                            <span className="chip bg-sky-50 text-sky-600 font-semibold">{p.category.name}</span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">-</span>
                          )}
                          {p.shelf && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                              <MapPin size={10} className="shrink-0" />
                              {p.shelf.code ? `[${p.shelf.code}] ` : ''}{p.shelf.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-right text-slate-500 text-xs">
                        {formatCurrency(p.importPrice)}
                      </td>
                      <td className="td text-right font-extrabold text-sky-600">
                        {formatCurrency(p.salePrice)}
                      </td>
                      <td className="td text-center">
                        <span className={`text-xs font-bold ${marginPercent >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {marginPercent > 0 ? `+${marginPercent}%` : `${marginPercent}%`}
                        </span>
                      </td>
                      <td className="td text-center">
                        <span className={`chip font-bold ${isLowStock ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {p.currentStock}
                        </span>
                      </td>
                      <td className="td text-right space-x-1">
                        <button
                          onClick={() => { setSelectedProductForBarcode(p); setBarcodeModalOpen(true); }}
                          className="icon-btn text-slate-600 hover:bg-slate-100"
                          title="In tem mã vạch"
                        >
                          <Barcode size={17} />
                        </button>
                        <button
                          onClick={() => openModal(p)}
                          className="icon-btn text-amber-500 hover:bg-amber-50"
                          title="Chỉnh sửa sản phẩm"
                        >
                          <Edit2 size={17} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="icon-btn text-rose-500 hover:bg-rose-50"
                          title="Xóa sản phẩm"
                        >
                          <Trash2 size={17} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onChange={setPage} />
      </div>

      {/* Modal Thêm / Sửa sản phẩm */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
        icon={<Package size={20} className="text-sky-500" />}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">Hủy</button>
            <button type="submit" form="product-form" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : (editingId ? 'Lưu thay đổi' : 'Thêm sản phẩm')}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Mã SKU / Mã vạch *</label>
              <input
                type="text"
                required
                autoFocus
                className="input font-mono uppercase font-bold"
                placeholder="VD: 8935049501503 hoặc SP001"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
              />
            </div>

            <div>
              <label className="label">Tên sản phẩm *</label>
              <input
                type="text"
                required
                className="input"
                placeholder="Nhập tên sản phẩm"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Danh mục</label>
              <select
                className="input"
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
              >
                <option value="">-- Chưa phân danh mục --</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="label">Vị trí kệ hàng</label>
              <select
                className="input"
                value={formData.shelfId}
                onChange={(e) => setFormData({ ...formData, shelfId: e.target.value })}
              >
                <option value="">-- Chưa xếp kệ --</option>
                {shelves.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `[${s.code}] ` : ''}{s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Giá nhập kho (Vốn)</label>
              <MoneyInput
                value={formData.importPrice}
                onChange={(val) => setFormData({ ...formData, importPrice: val })}
              />
            </div>

            <div>
              <label className="label">Giá bán ra *</label>
              <MoneyInput
                value={formData.salePrice}
                onChange={(val) => setFormData({ ...formData, salePrice: val })}
              />
            </div>

            <div>
              <label className="label">Mức tồn tối thiểu</label>
              <input
                type="number"
                min="0"
                className="input"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="label">Ảnh sản phẩm</label>
            <div className="flex items-center gap-3">
              {formData.imageUrl ? (
                <img src={formData.imageUrl} alt="Preview" className="w-14 h-14 rounded-2xl object-cover border border-slate-200" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300">
                  <ImageIcon size={22} />
                </div>
              )}
              <label className="btn-secondary text-xs cursor-pointer">
                <Upload size={14} /> {uploadingImage ? 'Đang tải...' : 'Chọn ảnh mới'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {formData.imageUrl && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, imageUrl: '' })}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Xóa ảnh
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal In tem mã vạch */}
      <Modal
        open={barcodeModalOpen}
        onClose={() => setBarcodeModalOpen(false)}
        title={`In tem mã vạch: ${selectedProductForBarcode?.name || ''}`}
        icon={<Barcode size={20} className="text-sky-500" />}
        footer={
          <>
            <button type="button" onClick={() => setBarcodeModalOpen(false)} className="btn-secondary">Hủy</button>
            <button type="button" onClick={handlePrintBarcodes} className="btn-primary">
              Bắt đầu in tem
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800 text-sm">{selectedProductForBarcode?.name}</p>
              <p className="text-xs text-slate-400 font-mono">SKU: {selectedProductForBarcode?.sku}</p>
            </div>
            <span className="font-bold text-sky-600">{formatCurrency(selectedProductForBarcode?.salePrice)}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Số lượng tem cần in</label>
              <input
                type="number"
                min="1"
                max="100"
                className="input"
                value={barcodeCopies}
                onChange={(e) => setBarcodeCopies(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Khổ in tem</label>
              <select
                className="input"
                value={barcodeLayout}
                onChange={(e) => setBarcodeLayout(e.target.value)}
              >
                <option value="a4">Khổ A4 (Lưới 3 cột tem dán)</option>
                <option value="roll">Cuộn decal máy in mã vạch (50x30mm)</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Products;
