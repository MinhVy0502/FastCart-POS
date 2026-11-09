import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { 
  Package, Plus, Edit2, Trash2, X, AlertCircle, Search, 
  Filter, Download, Upload, Barcode, CheckCircle2,
  MapPin, Layers, Building2, History, ArrowDownLeft,
  ArrowUpRight, RefreshCw, TrendingUp, Sparkles, Copy,
  Check, Calendar, Clock, AlertTriangle, Boxes, PlusCircle
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { useStore } from '../contexts/StoreContext';
import { PageHeader, Modal, MoneyInput, Pagination, EmptyState, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, formatStockBreakdown, getErrorMessage } from '../utils/format';
import { printBarcodeLabels } from '../utils/print';

const COMMON_UNITS = [
  'Cái', 'Lon', 'Chai', 'Hộp', 'Gói', 'Bịch', 'Túi', 'Vỉ', 'Lọ', 'Tuýp',
  'Kg', 'Gram', 'Lạng', 'Lít', 'Quả', 'Viên', 'Cuộn', 'Cây', 'Bộ', 'Đôi'
];

const UNIT_GROUPS = [
  {
    label: 'Đồ uống & Chất lỏng',
    units: ['Lon', 'Chai', 'Lốc', 'Thùng', 'Két', 'Lít', 'Bình', 'Can']
  },
  {
    label: 'Thực phẩm & Nông sản',
    units: ['Gói', 'Bịch', 'Túi', 'Hộp', 'Hũ', 'Khay', 'Quả', 'Chục', 'Bó', 'Kg', 'Gram', 'Lạng', 'Yến', 'Bao']
  },
  {
    label: 'Tạp hóa, Mỹ phẩm & Dược',
    units: ['Cái', 'Dây', 'Vỉ', 'Viên', 'Lọ', 'Tuýp', 'Cuộn', 'Cây']
  },
  {
    label: 'Gia dụng, VPP & Vật tư',
    units: ['Chiếc', 'Bộ', 'Đôi', 'Cặp', 'Quyển', 'Tập', 'Tờ', 'Mét']
  }
];

const PACKAGING_PRESETS = [
  {
    id: 'drink_can',
    label: 'Nước ngọt / Bia (Lốc 6, Thùng 24)',
    baseUnit: 'Lon',
    units: [
      { unitName: 'Lốc', conversionFactor: 6 },
      { unitName: 'Thùng', conversionFactor: 24 }
    ]
  },
  {
    id: 'drink_bottle',
    label: 'Bia / Nước giải khát (Két 20, Thùng 24)',
    baseUnit: 'Chai',
    units: [
      { unitName: 'Lốc', conversionFactor: 6 },
      { unitName: 'Két', conversionFactor: 20 },
      { unitName: 'Thùng', conversionFactor: 24 }
    ]
  },
  {
    id: 'milk',
    label: 'Sữa tươi / Sữa hộp (Lốc 4, Thùng 48)',
    baseUnit: 'Hộp',
    units: [
      { unitName: 'Lốc', conversionFactor: 4 },
      { unitName: 'Thùng', conversionFactor: 48 }
    ]
  },
  {
    id: 'noodle',
    label: 'Mì gói / Phở / Cháo (Lốc 10, Thùng 30)',
    baseUnit: 'Gói',
    units: [
      { unitName: 'Lốc', conversionFactor: 10 },
      { unitName: 'Thùng', conversionFactor: 30 }
    ]
  },
  {
    id: 'snack_sachet',
    label: 'Bánh kẹo / Gia vị / Dầu gội (Dây 10, Hộp 20, Thùng 100)',
    baseUnit: 'Gói',
    units: [
      { unitName: 'Dây', conversionFactor: 10 },
      { unitName: 'Hộp', conversionFactor: 20 },
      { unitName: 'Thùng', conversionFactor: 100 }
    ]
  },
  {
    id: 'pharma',
    label: 'Thuốc / Dược phẩm (Vỉ 10, Hộp 100)',
    baseUnit: 'Viên',
    units: [
      { unitName: 'Vỉ', conversionFactor: 10 },
      { unitName: 'Hộp', conversionFactor: 100 }
    ]
  },
  {
    id: 'rice_agri',
    label: 'Gạo / Nông sản (Túi 5kg, Yến 10kg, Bao 25kg, Bao 50kg)',
    baseUnit: 'Kg',
    units: [
      { unitName: 'Túi 5kg', conversionFactor: 5 },
      { unitName: 'Yến', conversionFactor: 10 },
      { unitName: 'Bao 25kg', conversionFactor: 25 },
      { unitName: 'Bao 50kg', conversionFactor: 50 }
    ]
  },
  {
    id: 'egg',
    label: 'Trứng / Thực phẩm tươi (Chục 10, Vỉ 30)',
    baseUnit: 'Quả',
    units: [
      { unitName: 'Chục', conversionFactor: 10 },
      { unitName: 'Vỉ', conversionFactor: 30 }
    ]
  },
  {
    id: 'stationery',
    label: 'Văn phòng phẩm / Bút viết (Lốc 10, Hộp 12)',
    baseUnit: 'Cây',
    units: [
      { unitName: 'Lốc', conversionFactor: 10 },
      { unitName: 'Hộp', conversionFactor: 12 }
    ]
  }
];

const QUICK_SECONDARY_UNITS = [
  { unitName: 'Lốc', conversionFactor: 4 },
  { unitName: 'Lốc', conversionFactor: 6 },
  { unitName: 'Dây', conversionFactor: 10 },
  { unitName: 'Vỉ', conversionFactor: 10 },
  { unitName: 'Chục', conversionFactor: 10 },
  { unitName: 'Hộp', conversionFactor: 12 },
  { unitName: 'Thùng', conversionFactor: 12 },
  { unitName: 'Két', conversionFactor: 20 },
  { unitName: 'Thùng', conversionFactor: 24 },
  { unitName: 'Thùng', conversionFactor: 30 },
  { unitName: 'Thùng', conversionFactor: 48 },
  { unitName: 'Bao', conversionFactor: 25 },
  { unitName: 'Bao', conversionFactor: 50 }
];

const MARGIN_PRESETS = [10, 15, 20, 30, 50, 100];

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [shelves, setShelves] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
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
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterExpiry, setFilterExpiry] = useState(false);
  const [page, setPage] = useState(1);

  // Modal & Form state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    unit: 'Cái',
    categoryId: '',
    shelfId: '',
    supplierId: '',
    importPrice: 0,
    salePrice: 0,
    wholesalePrice: 0,
    minStock: 10,
    hasExpiryDate: false,
    expiryWarningDays: 30,
    units: []
  });
  const [saving, setSaving] = useState(false);
  const [copiedSku, setCopiedSku] = useState(false);
  const [showAllUnits, setShowAllUnits] = useState(false);

  // Batch Management Modal state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchProduct, setBatchProduct] = useState(null);
  const [batchList, setBatchList] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [newBatchForm, setNewBatchForm] = useState({
    batchNumber: '',
    manufacturingDate: '',
    expiryDate: '',
    quantity: 1,
    note: ''
  });
  const [batchSaving, setBatchSaving] = useState(false);

  // Barcode Print Modal
  const [barcodeModalOpen, setBarcodeModalOpen] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);
  const [barcodeUnitIdx, setBarcodeUnitIdx] = useState(-1); // -1: ĐVT gốc, >=0: ĐVT quy đổi
  const [barcodeCopies, setBarcodeCopies] = useState(6);
  const [barcodeLayout, setBarcodeLayout] = useState('a4'); // 'a4' | 'roll'

  // History / Audit Trail Modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [historyFilterType, setHistoryFilterType] = useState(''); // '' | 'IN' | 'OUT' | 'ADJUST'
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPagination, setHistoryPagination] = useState(null);

  // Excel file input ref
  const excelInputRef = useRef(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterCategory) params.append('categoryId', filterCategory);
      if (filterShelf) params.append('shelfId', filterShelf);
      if (filterSupplier) params.append('supplierId', filterSupplier);
      if (filterExpiry) params.append('hasExpiry', 'true');
      
      const res = await api.get(`/products?${params.toString()}`);
      setProducts(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách sản phẩm'));
    } finally {
      setLoading(false);
    }
  };

  const fetchLookups = async () => {
    try {
      const [catRes, shelfRes, suppRes] = await Promise.all([
        api.get('/categories'),
        api.get('/shelves'),
        api.get('/suppliers?limit=500')
      ]);
      setCategories(catRes.data.data || []);
      setShelves(shelfRes.data.data || []);
      setSuppliers(suppRes.data.data || []);
    } catch (err) {
      console.error('Error fetching lookups:', err);
    }
  };

  useEffect(() => {
    fetchLookups();
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, filterCategory, filterShelf, filterSupplier, filterExpiry, page]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const action = params.get('action');
    const sku = params.get('sku');
    const qSearch = params.get('search');
    
    if (action === 'create' && sku) {
      setFormData(prev => ({ ...prev, sku: sku.toUpperCase(), barcode: sku }));
      setEditingId(null);
      setShowModal(true);
      navigate('/products', { replace: true });
    } else if (qSearch !== null) {
      setSearchTerm(qSearch);
      setPage(1);
    }
  }, [location.search, navigate]);

  const openModal = (product = null) => {
    if (product) {
      setEditingId(product.id);
      setFormData({
        sku: product.sku || '',
        barcode: product.barcode || '',
        name: product.name || '',
        unit: product.unit || 'Cái',
        categoryId: product.categoryId || '',
        shelfId: product.shelfId || '',
        supplierId: product.supplierId || '',
        importPrice: Number(product.importPrice) || 0,
        salePrice: Number(product.salePrice) || 0,
        wholesalePrice: Number(product.wholesalePrice) || 0,
        minStock: product.minStock || 10,
        hasExpiryDate: Boolean(product.hasExpiryDate),
        expiryWarningDays: product.expiryWarningDays || 30,
        units: (product.units || []).map(u => ({
          id: u.id,
          unitName: u.unitName || '',
          conversionFactor: u.conversionFactor || 1,
          barcode: u.barcode || '',
          salePrice: Number(u.salePrice) || 0,
          wholesalePrice: Number(u.wholesalePrice) || 0
        }))
      });
    } else {
      setEditingId(null);
      setFormData({
        sku: '',
        barcode: '',
        name: '',
        unit: 'Cái',
        categoryId: '',
        shelfId: '',
        supplierId: '',
        importPrice: 0,
        salePrice: 0,
        wholesalePrice: 0,
        minStock: 10,
        hasExpiryDate: false,
        expiryWarningDays: 30,
        units: []
      });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  // Secondary Units (Multi-UoM) Helpers
  const handleAddUnit = (unitName = '', factor = 12) => {
    const currentBasePrice = Number(formData.salePrice) || 0;
    const currentBaseWs = Number(formData.wholesalePrice) || 0;
    const f = Math.max(Number(factor) || 12, 2);
    setFormData(prev => ({
      ...prev,
      units: [
        ...prev.units,
        {
          unitName,
          conversionFactor: f,
          barcode: '',
          salePrice: currentBasePrice > 0 ? currentBasePrice * f : 0,
          wholesalePrice: currentBaseWs > 0 ? currentBaseWs * f : 0
        }
      ]
    }));
  };

  const handleQuickAddSecondaryUnit = (presetUnit) => {
    const exists = formData.units.some(
      (u) => u.unitName?.toLowerCase() === presetUnit.unitName.toLowerCase() && Number(u.conversionFactor) === presetUnit.conversionFactor
    );
    if (exists) {
      return toast.warning(`Quy cách ${presetUnit.unitName} (${presetUnit.conversionFactor} ${formData.unit || 'ĐVT'}) đã có trong danh sách`);
    }
    handleAddUnit(presetUnit.unitName, presetUnit.conversionFactor);
  };

  const handleApplyPackagingPreset = (preset) => {
    const currentBasePrice = Number(formData.salePrice) || 0;
    const currentBaseWs = Number(formData.wholesalePrice) || 0;
    setFormData(prev => ({
      ...prev,
      unit: preset.baseUnit || prev.unit || 'Cái',
      units: preset.units.map(u => ({
        unitName: u.unitName,
        conversionFactor: u.conversionFactor,
        barcode: '',
        salePrice: currentBasePrice > 0 ? currentBasePrice * u.conversionFactor : 0,
        wholesalePrice: currentBaseWs > 0 ? currentBaseWs * u.conversionFactor : 0
      }))
    }));
    toast.success(`Đã áp dụng mẫu quy cách: ${preset.label}`);
  };

  const handleUpdateUnit = (idx, field, val) => {
    setFormData(prev => {
      const copy = [...prev.units];
      const currentRow = copy[idx];
      if (!currentRow) return prev;

      if (field === 'conversionFactor') {
        const oldFactor = Math.max(Number(currentRow.conversionFactor) || 1, 1);
        const newFactor = Math.max(Number(val) || 2, 2);
        const baseSale = Number(prev.salePrice) || 0;
        const baseWs = Number(prev.wholesalePrice) || 0;
        const curSale = Number(currentRow.salePrice) || 0;
        const curWs = Number(currentRow.wholesalePrice) || 0;

        copy[idx] = {
          ...currentRow,
          conversionFactor: newFactor,
          salePrice: baseSale > 0 && (curSale === 0 || curSale === baseSale * oldFactor) ? baseSale * newFactor : curSale,
          wholesalePrice: baseWs > 0 && (curWs === 0 || curWs === baseWs * oldFactor) ? baseWs * newFactor : curWs
        };
      } else {
        copy[idx] = { ...currentRow, [field]: val };
      }
      return { ...prev, units: copy };
    });
  };

  const handleRecalcAllUnitsFromBase = () => {
    const baseSale = Number(formData.salePrice) || 0;
    const baseWs = Number(formData.wholesalePrice) || 0;
    if (baseSale <= 0 && baseWs <= 0) {
      return toast.warning('Vui lòng nhập Giá bán lẻ hoặc Giá bán sỉ của ĐVT gốc trước!');
    }
    setFormData(prev => ({
      ...prev,
      units: prev.units.map(u => {
        const factor = Math.max(Number(u.conversionFactor) || 2, 2);
        return {
          ...u,
          salePrice: baseSale > 0 ? baseSale * factor : u.salePrice,
          wholesalePrice: baseWs > 0 ? baseWs * factor : u.wholesalePrice
        };
      })
    }));
    toast.success('Đã tính lại giá các đơn vị quy đổi theo giá gốc!');
  };

  const handleRemoveUnit = (idx) => {
    setFormData(prev => ({
      ...prev,
      units: prev.units.filter((_, i) => i !== idx)
    }));
  };

  // Batch Management Helpers
  const openBatchModal = (product) => {
    setBatchProduct(product);
    setNewBatchForm({
      batchNumber: '',
      manufacturingDate: '',
      expiryDate: '',
      quantity: 1,
      note: ''
    });
    setBatchModalOpen(true);
    fetchProductBatches(product.id);
  };

  const fetchProductBatches = async (productId) => {
    try {
      setBatchLoading(true);
      const res = await api.get(`/products/${productId}/batches`);
      setBatchList(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách lô hàng'));
    } finally {
      setBatchLoading(false);
    }
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    if (!newBatchForm.batchNumber.trim() || !newBatchForm.expiryDate) {
      return toast.warning('Vui lòng nhập Số lô và Hạn sử dụng');
    }
    const qty = parseInt(newBatchForm.quantity);
    if (!qty || qty <= 0) {
      return toast.warning('Số lượng nhập lô phải lớn hơn 0');
    }
    try {
      setBatchSaving(true);
      await api.post(`/products/${batchProduct.id}/batches`, {
        batchNumber: newBatchForm.batchNumber.trim(),
        manufacturingDate: newBatchForm.manufacturingDate || null,
        expiryDate: newBatchForm.expiryDate,
        quantity: qty,
        note: newBatchForm.note.trim() || null
      });
      toast.success(`Đã thêm lô ${newBatchForm.batchNumber} thành công!`);
      setNewBatchForm({
        batchNumber: '',
        manufacturingDate: '',
        expiryDate: '',
        quantity: 1,
        note: ''
      });
      fetchProductBatches(batchProduct.id);
      fetchProducts();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Thêm lô hàng thất bại'));
    } finally {
      setBatchSaving(false);
    }
  };

  // Profit Margin Helpers
  const importNum = Number(formData.importPrice) || 0;
  const saleNum = Number(formData.salePrice) || 0;
  const wsNum = Number(formData.wholesalePrice) || 0;

  const grossProfit = saleNum - importNum;
  const profitMarginPercent = importNum > 0 
    ? ((grossProfit / importNum) * 100).toFixed(1) 
    : (saleNum > 0 ? '100.0' : '0.0');

  const wsProfit = wsNum - importNum;
  const wsMarginPercent = importNum > 0 
    ? ((wsProfit / importNum) * 100).toFixed(1) 
    : '0.0';

  const applyMarginPreset = (rate) => {
    if (importNum <= 0) {
      toast.warning('Vui lòng nhập giá vốn (giá nhập) trước khi áp dụng tỷ suất lợi nhuận!');
      return;
    }
    const rawPrice = importNum * (1 + rate / 100);
    // Round to nearest 500 VND for retail friendly prices
    const roundedPrice = Math.round(rawPrice / 500) * 500;
    setFormData(prev => ({ ...prev, salePrice: roundedPrice }));
  };

  const handleCopySkuToBarcode = () => {
    if (!formData.sku) return;
    setFormData(prev => ({ ...prev, barcode: prev.sku }));
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 1500);
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
        sku: formData.sku.trim().toUpperCase(),
        barcode: formData.barcode.trim() || null,
        name: formData.name.trim(),
        unit: formData.unit.trim() || 'Cái',
        categoryId: formData.categoryId || null,
        shelfId: formData.shelfId || null,
        supplierId: formData.supplierId || null,
        importPrice: Number(formData.importPrice) || 0,
        salePrice: Number(formData.salePrice) || 0,
        wholesalePrice: Number(formData.wholesalePrice) || 0,
        minStock: Number(formData.minStock) || 0,
        hasExpiryDate: Boolean(formData.hasExpiryDate),
        expiryWarningDays: Math.max(parseInt(formData.expiryWarningDays) || 30, 1),
        units: (formData.units || [])
          .filter(u => u.unitName && u.unitName.trim() && Number(u.conversionFactor) > 1)
          .map(u => ({
            unitName: u.unitName.trim(),
            conversionFactor: Number(u.conversionFactor),
            barcode: u.barcode ? u.barcode.trim() : null,
            salePrice: Number(u.salePrice) || 0,
            wholesalePrice: Number(u.wholesalePrice) || 0
          }))
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

  // Export products to Excel (fetch all matching products instead of current 15-row page)
  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams({ page: '1', limit: '2000' });
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (filterCategory) params.append('categoryId', filterCategory);
      if (filterShelf) params.append('shelfId', filterShelf);
      if (filterSupplier) params.append('supplierId', filterSupplier);
      if (filterExpiry) params.append('hasExpiry', 'true');

      const res = await api.get(`/products?${params.toString()}`);
      const allProducts = res.data?.data || products;

      if (allProducts.length === 0) return toast.warning('Chưa có sản phẩm để xuất file');
      const rows = allProducts.map(p => ({
        'Mã SKU': p.sku,
        'Mã vạch (Barcode)': p.barcode || '',
        'Tên sản phẩm': p.name,
        'Đơn vị tính': p.unit || 'Cái',
        'Quy cách đóng gói': (p.units || [])
          .map(u => `${u.unitName}:${u.conversionFactor}:${Number(u.salePrice) || 0}:${Number(u.wholesalePrice) || 0}:${u.barcode || ''}`)
          .join(' | '),
        'Danh mục': p.category?.name || '',
        'Kệ hàng': p.shelf ? (p.shelf.code ? `[${p.shelf.code}] ${p.shelf.name}` : p.shelf.name) : '',
        'Nhà cung cấp': p.supplier?.name || '',
        'Giá nhập': Number(p.importPrice) || 0,
        'Giá bán lẻ': Number(p.salePrice) || 0,
        'Giá bán sỉ': Number(p.wholesalePrice) || 0,
        'Tồn kho': p.currentStock || 0,
        'Mức tối thiểu': p.minStock || 0
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
      XLSX.writeFile(wb, `Danh_sach_san_pham_${Date.now()}.xlsx`);
      toast.success(`Đã xuất ${allProducts.length} sản phẩm ra file Excel!`);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi xuất file Excel'));
    }
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

        const rows = data.map(r => ({
          sku: r['Mã SKU'] || r['SKU'] || r['sku'] || r['Mã'] || '',
          barcode: r['Mã vạch (Barcode)'] || r['Mã vạch'] || r['Barcode'] || r['barcode'] || '',
          name: r['Tên sản phẩm'] || r['Tên'] || r['name'] || '',
          unit: r['Đơn vị tính'] || r['ĐVT'] || r['unit'] || 'Cái',
          unitsText: r['Quy cách đóng gói'] || r['ĐVT quy đổi'] || r['unitsText'] || '',
          category: r['Danh mục'] || r['category'] || '',
          supplier: r['Nhà cung cấp'] || r['NCC'] || r['supplier'] || '',
          importPrice: r['Giá nhập'] || r['importPrice'] || 0,
          salePrice: r['Giá bán lẻ'] || r['Giá bán'] || r['salePrice'] || 0,
          wholesalePrice: r['Giá bán sỉ'] || r['Giá sỉ'] || r['wholesalePrice'] || 0,
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
    let targetProduct = selectedProductForBarcode;
    if (barcodeUnitIdx >= 0 && selectedProductForBarcode.units?.[barcodeUnitIdx]) {
      const u = selectedProductForBarcode.units[barcodeUnitIdx];
      targetProduct = {
        ...selectedProductForBarcode,
        name: `${selectedProductForBarcode.name} (${u.unitName} x${u.conversionFactor} ${selectedProductForBarcode.unit || 'Cái'})`,
        barcode: u.barcode || selectedProductForBarcode.barcode || selectedProductForBarcode.sku,
        salePrice: Number(u.salePrice) > 0
          ? Number(u.salePrice)
          : (Number(selectedProductForBarcode.salePrice) || 0) * (Number(u.conversionFactor) || 1)
      };
    }
    printBarcodeLabels(
      [{ product: targetProduct, copies: Number(barcodeCopies) }],
      { layout: barcodeLayout, storeName: settings?.storeName || '' }
    );
    setBarcodeModalOpen(false);
  };

  // History / Audit Trail Action
  const openHistoryModal = async (product) => {
    setHistoryProduct(product);
    setHistoryFilterType('');
    setHistoryPage(1);
    setHistoryModalOpen(true);
    fetchHistoryData(product.id, 1, '');
  };

  const fetchHistoryData = async (productId, pageNum, type) => {
    try {
      setHistoryLoading(true);
      const params = new URLSearchParams({ page: String(pageNum), limit: '10' });
      if (type) params.append('type', type);
      const res = await api.get(`/products/${productId}/history?${params.toString()}`);
      setHistoryData(res.data.data?.transactions || []);
      setHistoryPagination(res.data.data?.pagination || null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không tải được lịch sử biến động kho'));
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleHistoryTypeChange = (type) => {
    setHistoryFilterType(type);
    setHistoryPage(1);
    if (historyProduct) {
      fetchHistoryData(historyProduct.id, 1, type);
    }
  };

  const handleHistoryPageChange = (newPage) => {
    setHistoryPage(newPage);
    if (historyProduct) {
      fetchHistoryData(historyProduct.id, newPage, historyFilterType);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        color="sky"
        title="Danh mục sản phẩm"
        subtitle="Quản lý mặt hàng, mã vạch (Barcode), đơn vị tính, tỷ suất lợi nhuận và lịch sử biến động kho"
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
        {/* Toolbar: Search & Filters */}
        <div className="flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Tìm theo tên SP, SKU hoặc mã vạch..."
              className="input pl-10 text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input w-full sm:w-36 text-xs"
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả danh mục</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <select
              className="input w-full sm:w-36 text-xs"
              value={filterShelf}
              onChange={(e) => { setFilterShelf(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả vị trí kệ</option>
              {shelves.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code ? `[${s.code}] ` : ''}{s.name}
                </option>
              ))}
            </select>

            <select
              className="input w-full sm:w-40 text-xs"
              value={filterSupplier}
              onChange={(e) => { setFilterSupplier(e.target.value); setPage(1); }}
            >
              <option value="">Tất cả nhà cung cấp</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => { setFilterExpiry(!filterExpiry); setPage(1); }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                filterExpiry
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/25'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
              title="Chỉ lọc các sản phẩm có theo dõi Hạn sử dụng"
            >
              <Calendar size={13} /> Có HSD
            </button>

            <span className="text-xs text-slate-400 font-medium whitespace-nowrap hidden xl:inline ml-1">
              {pagination?.total ? `Tổng ${pagination.total} SP` : ''}
            </span>
          </div>
        </div>

        {/* Products Table or Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={8} />
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
            <table className="w-full text-left border-collapse min-w-[960px]">
              <thead>
                <tr className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                  <th className="th">Mã SKU & Barcode</th>
                  <th className="th">Tên sản phẩm</th>
                  <th className="th">ĐVT & Quy đổi</th>
                  <th className="th">Phân loại & NCC</th>
                  <th className="th text-right">Giá nhập</th>
                  <th className="th text-right">Giá bán lẻ (Biên LN)</th>
                  <th className="th text-right">Giá bán sỉ</th>
                  <th className="th text-center">Tồn kho</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {products.map((p) => {
                  const isLowStock = p.currentStock <= p.minStock;
                  const itemImport = Number(p.importPrice) || 0;
                  const itemSale = Number(p.salePrice) || 0;
                  const margin = itemImport > 0 ? (((itemSale - itemImport) / itemImport) * 100).toFixed(0) : null;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="td">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                            {p.sku}
                          </span>
                          {p.barcode ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-400 dark:text-slate-500" title="Mã vạch Barcode">
                              <Barcode size={12} className="text-sky-500" />
                              {p.barcode}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Chưa có mã vạch</span>
                          )}
                        </div>
                      </td>
                      <td className="td font-bold text-slate-800 dark:text-slate-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center shrink-0">
                            <Package size={17} />
                          </div>
                          <div className="min-w-0">
                            <span className="line-clamp-2 max-w-xs">{p.name}</span>
                            {p.hasExpiryDate && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-1.5 py-0.2 rounded border border-amber-200/50 dark:border-amber-800/50">
                                  <Clock size={10} /> Theo dõi HSD ({p.batches?.length || 0} lô)
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <span className="chip bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs px-2 py-0.5">
                          {p.unit || 'Cái'}
                        </span>
                        {p.units && p.units.length > 0 && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            {p.units.map(u => (
                              <span key={u.id || u.unitName} className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/80 px-1.5 py-0.2 rounded border border-slate-200/50 dark:border-slate-700/50 truncate max-w-[140px]" title={`1 ${u.unitName} = ${u.conversionFactor} ${p.unit || 'Cái'}`}>
                                1 {u.unitName} = {u.conversionFactor} {p.unit || 'Cái'}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="td text-slate-500 text-xs">
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {p.category ? (
                              <span className="chip bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 font-semibold text-[11px]">
                                {p.category.name}
                              </span>
                            ) : null}
                            {p.shelf ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                                <MapPin size={10} className="shrink-0" />
                                {p.shelf.code ? `[${p.shelf.code}] ` : ''}{p.shelf.name}
                              </span>
                            ) : null}
                          </div>
                          {p.supplier ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full">
                              <Building2 size={10} className="shrink-0" />
                              {p.supplier.name}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="td text-right text-slate-500 dark:text-slate-400 text-xs">
                        {formatCurrency(p.importPrice)}
                      </td>
                      <td className="td text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-bold text-sky-600 dark:text-sky-400">
                            {formatCurrency(p.salePrice)}
                          </span>
                          {margin !== null && (
                            <span className={`text-[10px] font-semibold ${Number(margin) >= 20 ? 'text-emerald-500' : 'text-slate-400'}`}>
                              +{margin}%
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-right">
                        {Number(p.wholesalePrice) > 0 ? (
                          <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(p.wholesalePrice)}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Chưa đặt</span>
                        )}
                      </td>
                      <td className="td text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className={`chip font-bold text-xs ${isLowStock ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'}`}>
                            {p.currentStock} {p.unit || 'Cái'}
                          </span>
                          {formatStockBreakdown(p.currentStock, p.unit, p.units) && (
                            <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 bg-sky-50/80 dark:bg-sky-950/40 px-1.5 py-0.2 rounded">
                              ≈ {formatStockBreakdown(p.currentStock, p.unit, p.units)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => openBatchModal(p)}
                          className="icon-btn text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-slate-800"
                          title="Quản lý lô hàng & hạn sử dụng (FEFO)"
                        >
                          <Boxes size={17} />
                        </button>
                        <button
                          onClick={() => openHistoryModal(p)}
                          className="icon-btn text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-slate-800"
                          title="Lịch sử biến động kho (Audit Trail)"
                        >
                          <History size={17} />
                        </button>
                        <button
                          onClick={() => { setSelectedProductForBarcode(p); setBarcodeUnitIdx(-1); setBarcodeModalOpen(true); }}
                          className="icon-btn text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                          title="In tem mã vạch"
                        >
                          <Barcode size={17} />
                        </button>
                        <button
                          onClick={() => openModal(p)}
                          className="icon-btn text-amber-500 hover:bg-amber-50 dark:hover:bg-slate-800"
                          title="Chỉnh sửa sản phẩm"
                        >
                          <Edit2 size={17} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="icon-btn text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800"
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
        <form id="product-form" onSubmit={handleSubmit} className="space-y-4 max-h-[80vh] overflow-y-auto px-1 py-1">
          {/* Row 1: SKU & Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Mã SKU (Mã nội bộ) *</label>
              <input
                type="text"
                required
                autoFocus
                className="input font-mono uppercase font-bold"
                placeholder="VD: SP001 hoặc COCA-330"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
              />
              <p className="text-[11px] text-slate-400 mt-1">Mã quản lý kho duy nhất trong hệ thống</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Mã vạch (Barcode / EAN-13)</label>
                {formData.sku && (
                  <button
                    type="button"
                    onClick={handleCopySkuToBarcode}
                    className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    {copiedSku ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    {copiedSku ? 'Đã sao chép!' : 'Lấy từ SKU'}
                  </button>
                )}
              </div>
              <div className="relative">
                <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text"
                  className="input pl-9 font-mono"
                  placeholder="Quét hoặc nhập mã vạch EAN trên bao bì"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Dùng để quét nhanh bằng súng barcode tại quầy POS</p>
            </div>
          </div>

          {/* Row 2: Tên sản phẩm & Đơn vị tính */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Tên sản phẩm *</label>
              <input
                type="text"
                required
                className="input"
                placeholder="Nhập tên sản phẩm đầy đủ"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Đơn vị tính gốc (ĐVT) *</label>
                <button
                  type="button"
                  onClick={() => setShowAllUnits(!showAllUnits)}
                  className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline"
                >
                  {showAllUnits ? 'Thu gọn' : 'Tất cả ngành hàng'}
                </button>
              </div>
              <input
                type="text"
                required
                className="input"
                placeholder="VD: Cái, Lon, Hộp, Kg, Viên, Bó..."
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              />
              {!showAllUnits ? (
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {COMMON_UNITS.slice(0, 12).map(u => (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setFormData({ ...formData, unit: u })}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${
                        formData.unit === u 
                          ? 'bg-sky-500 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 max-h-44 overflow-y-auto">
                  {UNIT_GROUPS.map((g) => (
                    <div key={g.label}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        {g.label}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {g.units.map((u) => (
                          <button
                            type="button"
                            key={u}
                            onClick={() => setFormData({ ...formData, unit: u })}
                            className={`text-[10px] px-1.5 py-0.5 rounded font-semibold transition-colors ${
                              formData.unit === u
                                ? 'bg-sky-500 text-white'
                                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-sky-400'
                            }`}
                          >
                            {u}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Danh mục, Vị trí kệ, Nhà cung cấp ưu tiên */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Danh mục hàng hóa</label>
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

            <div>
              <label className="label">Nhà cung cấp ưu tiên</label>
              <select
                className="input"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Giá cả & Mức tồn */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
            <div>
              <label className="label">Giá vốn (Giá nhập)</label>
              <MoneyInput
                value={formData.importPrice}
                onChange={(val) => setFormData({ ...formData, importPrice: val })}
              />
            </div>

            <div>
              <label className="label">Giá bán lẻ *</label>
              <MoneyInput
                value={formData.salePrice}
                onChange={(val) => setFormData({ ...formData, salePrice: val })}
              />
            </div>

            <div>
              <label className="label flex items-center justify-between">
                <span>Giá bán sỉ</span>
                <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">Đại lý</span>
              </label>
              <MoneyInput
                value={formData.wholesalePrice}
                onChange={(val) => setFormData({ ...formData, wholesalePrice: val })}
              />
            </div>

            <div>
              <label className="label">Tồn kho tối thiểu</label>
              <input
                type="number"
                min="0"
                className="input"
                value={formData.minStock}
                onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Profit Margin & Markup Preset Tool */}
          <div className="bg-slate-50 dark:bg-[#151f33] p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <TrendingUp size={15} className="text-emerald-500" />
                <span>Công cụ tính Tỷ suất Lợi nhuận (Margin)</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div>
                  <span className="text-slate-400">Lãi gộp: </span>
                  <span className={`font-bold ${grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {grossProfit >= 0 ? `+${formatCurrency(grossProfit)}` : formatCurrency(grossProfit)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Biên độ: </span>
                  <span className={`font-bold ${Number(profitMarginPercent) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                    {Number(profitMarginPercent) >= 0 ? `+${profitMarginPercent}%` : `${profitMarginPercent}%`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-slate-400 font-medium mr-1 flex items-center gap-1">
                <Sparkles size={11} className="text-amber-500" /> Đặt giá theo % lãi vốn:
              </span>
              {MARGIN_PRESETS.map((pct) => (
                <button
                  type="button"
                  key={pct}
                  onClick={() => applyMarginPreset(pct)}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-600 text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
                  title={`Tự động đặt giá bán lẻ với lợi nhuận +${pct}% so với giá vốn`}
                >
                  +{pct}%
                </button>
              ))}
            </div>

            {wsNum > 0 && (
              <div className="text-[11px] text-slate-400 border-t border-slate-200/50 dark:border-slate-800/80 pt-2 flex items-center justify-between">
                <span>Biên lợi nhuận bán sỉ đại lý:</span>
                <span className={`font-semibold ${wsProfit >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-500'}`}>
                  {wsProfit >= 0 ? `+${formatCurrency(wsProfit)} (+${wsMarginPercent}%)` : `${formatCurrency(wsProfit)} (${wsMarginPercent}%)`}
                </span>
              </div>
            )}
          </div>

          {/* Section: Đơn vị tính quy đổi (Multi-UoM) */}
          <div className="bg-slate-50 dark:bg-[#151f33] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Layers size={15} className="text-sky-500" />
                  <span>Quy cách đóng gói & Đơn vị tính quy đổi (Thùng, Lốc, Vỉ, Bao...)</span>
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Đơn vị cơ bản (tồn kho): <strong className="text-sky-600 dark:text-sky-400">{formData.unit || 'Cái'}</strong>. Chọn mẫu ngành hàng hoặc thêm đơn vị lớn hơn để tự động quy đổi khi nhập/bán.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {formData.units.length > 0 && (
                  <button
                    type="button"
                    onClick={handleRecalcAllUnitsFromBase}
                    className="btn-secondary py-1 px-2.5 text-xs rounded-xl flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold"
                    title="Tính lại giá lẻ & giá sỉ của tất cả ĐVT quy đổi = Giá gốc × Hệ số quy đổi"
                  >
                    <RefreshCw size={13} /> Tính lại theo giá gốc
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleAddUnit('', 12)}
                  className="btn-secondary py-1 px-2.5 text-xs rounded-xl flex items-center gap-1 text-sky-600 dark:text-sky-400 font-bold"
                >
                  <Plus size={14} /> Thêm ĐVT quy đổi
                </button>
              </div>
            </div>

            {/* Mẫu quy cách đóng gói 1 chạm theo ngành hàng */}
            <div className="bg-white/80 dark:bg-slate-900/50 p-2.5 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                  <Sparkles size={12} className="text-amber-500" /> Áp dụng nhanh mẫu quy cách theo ngành hàng:
                </span>
                <select
                  className="input py-1 px-2.5 text-xs w-full sm:w-auto sm:min-w-[280px] font-semibold"
                  value=""
                  onChange={(e) => {
                    const found = PACKAGING_PRESETS.find(p => p.id === e.target.value);
                    if (found) handleApplyPackagingPreset(found);
                  }}
                >
                  <option value="">-- Chọn mẫu đóng gói phổ biến (Tự điền ĐVT gốc + Quy đổi) --</option>
                  {PACKAGING_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} (ĐVT gốc: {preset.baseUnit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-[10px] text-slate-400 font-semibold mr-1">Thêm lẻ 1 chạm:</span>
                {QUICK_SECONDARY_UNITS.map((qu) => (
                  <button
                    type="button"
                    key={`${qu.unitName}-${qu.conversionFactor}`}
                    onClick={() => handleQuickAddSecondaryUnit(qu)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-sky-950/60 text-slate-600 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 border border-transparent hover:border-sky-300 font-semibold transition-all"
                    title={`Thêm nhanh 1 ${qu.unitName} = ${qu.conversionFactor} ${formData.unit || 'ĐVT'}`}
                  >
                    + {qu.unitName} ({qu.conversionFactor})
                  </button>
                ))}
              </div>
            </div>

            {formData.units.length === 0 ? (
              <div className="text-center py-3 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                Sản phẩm chỉ bán theo ĐVT cơ bản (<strong className="text-slate-600 dark:text-slate-300">{formData.unit || 'Cái'}</strong>). Chọn mẫu phía trên hoặc bấm &quot;Thêm ĐVT quy đổi&quot; nếu có bán theo Thùng, Lốc, Vỉ, Bao...
              </div>
            ) : (
              <div className="space-y-2">
                {formData.units.map((u, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Tên ĐVT quy đổi *</label>
                      <input
                        type="text"
                        required
                        placeholder="VD: Thùng, Lốc, Vỉ, Bao"
                        className="input py-1 text-xs font-semibold"
                        value={u.unitName}
                        onChange={(e) => handleUpdateUnit(idx, 'unitName', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">
                        Quy đổi (= N {formData.unit || 'ĐVT'}) *
                      </label>
                      <input
                        type="number"
                        min="2"
                        required
                        className="input py-1 text-xs font-bold font-mono"
                        value={u.conversionFactor}
                        onChange={(e) => handleUpdateUnit(idx, 'conversionFactor', Math.max(parseInt(e.target.value) || 2, 2))}
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Mã vạch riêng (tùy chọn)</label>
                      <input
                        type="text"
                        placeholder="Quét mã trên thùng/lốc..."
                        className="input py-1 text-xs font-mono"
                        value={u.barcode || ''}
                        onChange={(e) => handleUpdateUnit(idx, 'barcode', e.target.value)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Giá bán lẻ</label>
                      <MoneyInput
                        value={u.salePrice}
                        onChange={(val) => handleUpdateUnit(idx, 'salePrice', val)}
                      />
                    </div>

                    <div className="sm:col-span-1">
                      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Giá sỉ</label>
                      <MoneyInput
                        value={u.wholesalePrice}
                        onChange={(val) => handleUpdateUnit(idx, 'wholesalePrice', val)}
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-end justify-center pt-2 sm:pt-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveUnit(idx)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                        title="Xóa đơn vị quy đổi"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Quản lý Lô hàng & Hạn sử dụng (FEFO) */}
          <div className="bg-slate-50 dark:bg-[#151f33] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-400 w-4 h-4"
                  checked={formData.hasExpiryDate}
                  onChange={(e) => setFormData({ ...formData, hasExpiryDate: e.target.checked })}
                />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <Clock size={15} className="text-amber-500" />
                  Theo dõi Hạn sử dụng & Lô hàng (FEFO)
                </span>
              </label>

              {formData.hasExpiryDate && (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                  Xuất kho FEFO tự động
                </span>
              )}
            </div>

            {formData.hasExpiryDate && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Cảnh báo trước ngày hết hạn (ngày)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="365"
                    className="input text-xs"
                    value={formData.expiryWarningDays}
                    onChange={(e) => setFormData({ ...formData, expiryWarningDays: Math.max(parseInt(e.target.value) || 30, 1) })}
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Hệ thống sẽ gắn cờ cảnh báo trên màn hình kho và bảng điều khiển khi lô hàng còn dưới số ngày này.
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertTriangle size={13} className="text-amber-500 shrink-0" />
                    Quy tắc xuất kho FEFO (First Expired First Out):
                  </p>
                  <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                    Khi bán hàng tại quầy POS, hệ thống tự động trừ kho từ lô hàng có hạn sử dụng gần nhất trước, tránh thất thoát do hàng quá hạn.
                  </p>
                </div>
              </div>
            )}
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
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {selectedProductForBarcode?.name}
                {barcodeUnitIdx >= 0 && selectedProductForBarcode?.units?.[barcodeUnitIdx] && (
                  <span className="ml-1.5 text-xs text-sky-600 dark:text-sky-400 font-semibold">
                    ({selectedProductForBarcode.units[barcodeUnitIdx].unitName} x{selectedProductForBarcode.units[barcodeUnitIdx].conversionFactor} {selectedProductForBarcode.unit || 'Cái'})
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-400 font-mono">SKU: {selectedProductForBarcode?.sku}</span>
                <span className="text-xs text-sky-500 font-mono">
                  Mã in: {
                    barcodeUnitIdx >= 0 && selectedProductForBarcode?.units?.[barcodeUnitIdx]?.barcode
                      ? selectedProductForBarcode.units[barcodeUnitIdx].barcode
                      : (selectedProductForBarcode?.barcode || selectedProductForBarcode?.sku)
                  }
                </span>
              </div>
            </div>
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {formatCurrency(
                barcodeUnitIdx >= 0 && selectedProductForBarcode?.units?.[barcodeUnitIdx]
                  ? (Number(selectedProductForBarcode.units[barcodeUnitIdx].salePrice) > 0
                      ? selectedProductForBarcode.units[barcodeUnitIdx].salePrice
                      : (Number(selectedProductForBarcode?.salePrice) || 0) * (Number(selectedProductForBarcode.units[barcodeUnitIdx].conversionFactor) || 1))
                  : selectedProductForBarcode?.salePrice
              )}
            </span>
          </div>

          {selectedProductForBarcode?.units?.length > 0 && (
            <div>
              <label className="label">Chọn quy cách đóng gói để in tem</label>
              <select
                className="input text-xs font-semibold"
                value={barcodeUnitIdx}
                onChange={(e) => setBarcodeUnitIdx(Number(e.target.value))}
              >
                <option value={-1}>
                  ĐVT gốc: {selectedProductForBarcode.unit || 'Cái'} — {formatCurrency(selectedProductForBarcode.salePrice)} (Mã: {selectedProductForBarcode.barcode || selectedProductForBarcode.sku})
                </option>
                {selectedProductForBarcode.units.map((u, idx) => (
                  <option key={u.id || idx} value={idx}>
                    Quy đổi: 1 {u.unitName} = {u.conversionFactor} {selectedProductForBarcode.unit || 'Cái'} — {formatCurrency(u.salePrice || (selectedProductForBarcode.salePrice * u.conversionFactor))} {u.barcode ? `(Mã: ${u.barcode})` : '(Dùng mã gốc)'}
                  </option>
                ))}
              </select>
            </div>
          )}

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

      {/* Modal Lịch sử biến động kho (Audit Trail) */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title={`Lịch sử xuất nhập tồn: ${historyProduct?.name || ''}`}
        icon={<History size={20} className="text-indigo-500" />}
        footer={
          <button type="button" onClick={() => setHistoryModalOpen(false)} className="btn-secondary">
            Đóng
          </button>
        }
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* Product Header Summary */}
          <div className="bg-slate-50 dark:bg-[#151f33] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{historyProduct?.name}</h4>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                <span>SKU: {historyProduct?.sku}</span>
                {historyProduct?.barcode && <span>· Mã vạch: {historyProduct?.barcode}</span>}
                <span>· ĐVT: {historyProduct?.unit || 'Cái'}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Tồn kho hiện tại</span>
              <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                {historyProduct?.currentStock} {historyProduct?.unit || 'Cái'}
              </span>
              {historyProduct && formatStockBreakdown(historyProduct.currentStock, historyProduct.unit, historyProduct.units) && (
                <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 block">
                  (≈ {formatStockBreakdown(historyProduct.currentStock, historyProduct.unit, historyProduct.units)})
                </span>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: '', label: 'Tất cả biến động' },
              { id: 'IN', label: 'Nhập kho (IN)' },
              { id: 'OUT', label: 'Xuất bán (OUT)' },
              { id: 'ADJUST', label: 'Điều chỉnh kiểm kê' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleHistoryTypeChange(tab.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  historyFilterType === tab.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* History table */}
          {historyLoading ? (
            <SkeletonRows rows={4} cols={4} />
          ) : historyData.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Chưa có giao dịch biến động kho nào cho sản phẩm này.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase tracking-wider">
                    <th className="th py-2">Thời gian</th>
                    <th className="th py-2">Loại biến động</th>
                    <th className="th py-2 text-right">Số lượng</th>
                    <th className="th py-2">Mã chứng từ</th>
                    <th className="th py-2">Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {historyData.map(tx => {
                    const isPositive = tx.type === 'IN' || (tx.type === 'ADJUST' && tx.quantity > 0);
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                        <td className="td py-2.5 text-slate-500 whitespace-nowrap">
                          {formatDate(tx.createdAt)}
                        </td>
                        <td className="td py-2.5">
                          {tx.type === 'IN' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                              <ArrowDownLeft size={12} /> Nhập hàng
                            </span>
                          )}
                          {tx.type === 'OUT' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded-full">
                              <ArrowUpRight size={12} /> Bán hàng
                            </span>
                          )}
                          {tx.type === 'ADJUST' && (
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full">
                              <RefreshCw size={11} /> Điều chỉnh
                            </span>
                          )}
                        </td>
                        <td className="td py-2.5 text-right font-extrabold">
                          <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                            {isPositive ? `+${tx.quantity}` : `${tx.quantity}`} {historyProduct?.unit || 'Cái'}
                          </span>
                        </td>
                        <td className="td py-2.5 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {tx.referenceCode || '-'}
                        </td>
                        <td className="td py-2.5 text-slate-500 max-w-xs truncate" title={tx.note}>
                          {tx.note || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {historyPagination && (
            <Pagination pagination={historyPagination} onChange={handleHistoryPageChange} />
          )}
        </div>
      </Modal>

      {/* Modal Quản lý Lô hàng & Hạn sử dụng (FEFO) */}
      <Modal
        open={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        title={`Quản lý Lô hàng & HSD: ${batchProduct?.name || ''}`}
        icon={<Boxes size={20} className="text-teal-500" />}
        footer={
          <button type="button" onClick={() => setBatchModalOpen(false)} className="btn-secondary">
            Đóng
          </button>
        }
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
          {/* Product Header Summary */}
          <div className="bg-slate-50 dark:bg-[#151f33] p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm">{batchProduct?.name}</h4>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                <span>SKU: {batchProduct?.sku}</span>
                {batchProduct?.barcode && <span>· Barcode: {batchProduct?.barcode}</span>}
                <span>· ĐVT: {batchProduct?.unit || 'Cái'}</span>
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Tổng tồn kho</span>
              <span className="text-base font-extrabold text-teal-600 dark:text-teal-400">
                {batchProduct?.currentStock} {batchProduct?.unit || 'Cái'}
              </span>
            </div>
          </div>

          {/* Form thêm lô hàng mới trực tiếp */}
          <form onSubmit={handleCreateBatch} className="bg-teal-50/50 dark:bg-teal-950/20 p-4 rounded-2xl border border-teal-100 dark:border-teal-900/50 space-y-3">
            <h5 className="text-xs font-bold text-teal-800 dark:text-teal-200 flex items-center gap-1.5">
              <PlusCircle size={15} className="text-teal-500" />
              <span>Nhập thêm lô hàng mới vào kho</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Số lô (Batch / Lot) *</label>
                <input
                  type="text"
                  required
                  placeholder="VD: LOT-2026-01"
                  className="input py-1.5 text-xs font-mono font-bold"
                  value={newBatchForm.batchNumber}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, batchNumber: e.target.value.toUpperCase() })}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Ngày sản xuất (NSX)</label>
                <input
                  type="date"
                  className="input py-1.5 text-xs"
                  value={newBatchForm.manufacturingDate}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, manufacturingDate: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">Hạn sử dụng (HSD) *</label>
                <input
                  type="date"
                  required
                  className="input py-1.5 text-xs font-bold text-amber-600"
                  value={newBatchForm.expiryDate}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, expiryDate: e.target.value })}
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Số lượng nhập ({batchProduct?.unit || 'Cái'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  className="input py-1.5 text-xs font-bold"
                  value={newBatchForm.quantity}
                  onChange={(e) => setNewBatchForm({ ...newBatchForm, quantity: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Ghi chú về lô hàng (tùy chọn)..."
                className="input py-1.5 text-xs flex-1"
                value={newBatchForm.note}
                onChange={(e) => setNewBatchForm({ ...newBatchForm, note: e.target.value })}
              />
              <button
                type="submit"
                disabled={batchSaving}
                className="btn-primary py-1.5 px-4 text-xs shrink-0 font-bold bg-teal-600 hover:bg-teal-700"
              >
                {batchSaving ? 'Đang lưu...' : '+ Nhập lô này'}
              </button>
            </div>
          </form>

          {/* Danh sách các lô hiện có */}
          <div>
            <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
              <span>Danh sách các lô hàng hiện có ({batchList.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Sắp xếp theo thứ tự FEFO (HSD gần nhất lên trước)</span>
            </h5>

            {batchLoading ? (
              <SkeletonRows rows={3} cols={5} />
            ) : batchList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                Sản phẩm chưa có lô hàng nào. Hãy thêm lô đầu tiên ở biểu mẫu trên hoặc qua phiếu nhập hàng.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 uppercase tracking-wider">
                      <th className="th py-2">Số lô</th>
                      <th className="th py-2">Hạn sử dụng</th>
                      <th className="th py-2">Ngày SX</th>
                      <th className="th py-2 text-right">Số lượng còn</th>
                      <th className="th py-2 text-center">Trạng thái HSD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                    {batchList.map(b => {
                      const exp = new Date(b.expiryDate);
                      const now = new Date();
                      const diffTime = exp.getTime() - now.getTime();
                      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const isExpired = daysLeft <= 0;
                      const isNearExpiry = daysLeft > 0 && daysLeft <= (batchProduct?.expiryWarningDays || 30);

                      return (
                        <tr key={b.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                          <td className="td py-2.5 font-mono font-bold text-slate-700 dark:text-slate-200">
                            {b.batchNumber}
                          </td>
                          <td className="td py-2.5 font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {formatDate(b.expiryDate)}
                          </td>
                          <td className="td py-2.5 text-slate-400 whitespace-nowrap">
                            {b.manufacturingDate ? formatDate(b.manufacturingDate) : '-'}
                          </td>
                          <td className="td py-2.5 text-right font-extrabold whitespace-nowrap">
                            <span className="text-teal-600 dark:text-teal-400">
                              {b.currentQuantity}
                            </span>
                            <span className="text-slate-400 font-normal"> / {b.initialQuantity} {batchProduct?.unit || 'Cái'}</span>
                          </td>
                          <td className="td py-2.5 text-center whitespace-nowrap">
                            {isExpired ? (
                              <span className="chip font-bold text-[10px] bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                                Đã hết hạn ({Math.abs(daysLeft)} ngày trước)
                              </span>
                            ) : isNearExpiry ? (
                              <span className="chip font-bold text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
                                Cận date (Còn {daysLeft} ngày)
                              </span>
                            ) : (
                              <span className="chip font-bold text-[10px] bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                                Còn {daysLeft} ngày
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Products;
