import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers, Plus, Edit2, Trash2, Search, Eye, 
  Package, MapPin, CheckCircle2, Box, ArrowRight, ExternalLink 
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, EmptyState, SkeletonRows } from '../components/ui';
import { formatCurrency, getErrorMessage } from '../utils/format';

const Shelves = () => {
  const { toast, confirm } = useToast();
  const navigate = useNavigate();

  const [shelves, setShelves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingShelf, setEditingShelf] = useState(null);
  const [formData, setFormData] = useState({ name: '', code: '', description: '' });
  const [saving, setSaving] = useState(false);

  // Products Drawer / Modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedShelf, setSelectedShelf] = useState(null);
  const [shelfProducts, setShelfProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const fetchShelves = async () => {
    try {
      setLoading(true);
      const res = await api.get('/shelves');
      setShelves(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách kệ hàng'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShelves();
  }, []);

  const openModal = (shelf = null) => {
    if (shelf) {
      setEditingShelf(shelf);
      setFormData({
        name: shelf.name,
        code: shelf.code || '',
        description: shelf.description || ''
      });
    } else {
      setEditingShelf(null);
      setFormData({ name: '', code: '', description: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.warning('Tên kệ hàng là bắt buộc');

    try {
      setSaving(true);
      if (editingShelf) {
        await api.put(`/shelves/${editingShelf.id}`, formData);
        toast.success('Cập nhật kệ hàng thành công');
      } else {
        await api.post('/shelves', formData);
        toast.success('Thêm kệ hàng mới thành công');
      }
      closeModal();
      fetchShelves();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lưu kệ hàng thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (shelf) => {
    const ok = await confirm({
      title: 'Xóa kệ hàng?',
      message: `Bạn có chắc muốn xóa "${shelf.name}"? Các sản phẩm trên kệ này sẽ được chuyển về trạng thái Chưa xếp kệ (không bị xóa dữ liệu sản phẩm).`,
      danger: true,
      confirmText: 'Xóa kệ'
    });
    if (!ok) return;

    try {
      await api.delete(`/shelves/${shelf.id}`);
      toast.success('Đã xóa kệ hàng');
      fetchShelves();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Xóa kệ hàng thất bại'));
    }
  };

  const openShelfProducts = async (shelf) => {
    setSelectedShelf(shelf);
    setDetailModalOpen(true);
    try {
      setLoadingProducts(true);
      const res = await api.get(`/shelves/${shelf.id}`);
      setShelfProducts(res.data.data?.products || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải sản phẩm trên kệ'));
    } finally {
      setLoadingProducts(false);
    }
  };

  // Filtered shelves
  const filteredShelves = shelves.filter(s => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.code?.toLowerCase().includes(term) ||
      s.description?.toLowerCase().includes(term)
    );
  });

  // Summary statistics
  const totalShelves = shelves.length;
  const occupiedShelves = shelves.filter(s => Number(s.productCount) > 0).length;
  const emptyShelves = totalShelves - occupiedShelves;
  const totalAssignedProducts = shelves.reduce((acc, s) => acc + (Number(s.productCount) || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Layers}
        color="sky"
        title="Quản lý kệ hàng & Vị trí"
        subtitle="Sắp xếp và định vị vị trí hàng hóa trên từng kệ, ngăn giúp nhân viên tìm kiếm ngay khi khách hỏi"
        actions={
          <button onClick={() => openModal()} className="btn-primary">
            <Plus size={18} /> Thêm kệ hàng
          </button>
        }
      />

      {/* Stats summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center shrink-0">
            <Layers size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">Tổng số kệ</p>
            <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{totalShelves}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">Kệ có hàng</p>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{occupiedShelves}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shrink-0">
            <Box size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">Kệ còn trống</p>
            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{emptyShelves}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-violet-50 dark:bg-violet-950/40 text-violet-500 flex items-center justify-center shrink-0">
            <Package size={22} />
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-400 font-medium">Tổng SP đã xếp kệ</p>
            <p className="text-xl font-extrabold text-violet-600 dark:text-violet-400">{totalAssignedProducts}</p>
          </div>
        </div>
      </div>

      {/* Main card */}
      <div className="card p-5 sm:p-6 space-y-5">
        {/* Search toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              type="text"
              placeholder="Tìm theo tên kệ, mã kệ hoặc vị trí..."
              className="input pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <span className="text-xs text-slate-400 font-medium self-end sm:self-center">
            Hiển thị {filteredShelves.length} / {shelves.length} kệ
          </span>
        </div>

        {/* Content list or empty state */}
        {loading ? (
          <SkeletonRows rows={4} cols={3} />
        ) : filteredShelves.length === 0 ? (
          <EmptyState
            icon={Layers}
            title={searchTerm ? 'Không tìm thấy kệ hàng nào phù hợp' : 'Chưa có kệ hàng nào'}
            description={
              searchTerm
                ? `Không có kệ nào khớp với từ khóa "${searchTerm}".`
                : 'Tạo các kệ hàng (VD: Kệ A1 - Gia vị, Kệ B2 - Bánh kẹo) để định vị sản phẩm trong kho và cửa hàng.'
            }
            action={
              searchTerm ? (
                <button onClick={() => setSearchTerm('')} className="btn-secondary">
                  Xóa tìm kiếm
                </button>
              ) : (
                <button onClick={() => openModal()} className="btn-primary">
                  <Plus size={16} /> Thêm kệ đầu tiên
                </button>
              )
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShelves.map((shelf) => {
              const count = Number(shelf.productCount) || 0;
              return (
                <div
                  key={shelf.id}
                  className="card p-4 sm:p-5 flex flex-col justify-between hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-md transition-all group relative overflow-hidden"
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center shrink-0">
                          <Layers size={18} />
                        </div>
                        <div>
                          {shelf.code && (
                            <span className="inline-block text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mb-0.5">
                              {shelf.code}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => openModal(shelf)}
                          className="icon-btn text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                          title="Chỉnh sửa kệ"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(shelf)}
                          className="icon-btn text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Xóa kệ hàng"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-snug">
                      {shelf.name}
                    </h3>

                    {shelf.description ? (
                      <p className="text-xs text-slate-400 dark:text-slate-400 mt-1.5 line-clamp-2 flex items-start gap-1">
                        <MapPin size={13} className="shrink-0 mt-0.5 text-slate-400" />
                        <span>{shelf.description}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-slate-300 dark:text-slate-600 mt-1.5 italic">
                        Chưa có mô tả vị trí
                      </p>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5 ${
                      count > 0 
                        ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                    }`}>
                      <Package size={13} />
                      {count > 0 ? `${count} sản phẩm` : 'Trống (0 SP)'}
                    </span>

                    <button
                      onClick={() => openShelfProducts(shelf)}
                      className="text-xs font-bold text-sky-500 dark:text-sky-400 hover:text-sky-600 flex items-center gap-1 hover:underline"
                    >
                      <span>Xem hàng</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Thêm / Chỉnh sửa kệ */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingShelf ? 'Chỉnh sửa kệ hàng' : 'Thêm kệ hàng mới'}
        icon={<Layers size={20} className="text-sky-500" />}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">Hủy</button>
            <button type="submit" form="shelf-form" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : (editingShelf ? 'Lưu thay đổi' : 'Thêm kệ hàng')}
            </button>
          </>
        }
      >
        <form id="shelf-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Mã kệ (tùy chọn)</label>
              <input
                type="text"
                className="input font-mono uppercase font-bold"
                placeholder="VD: A1, B2-T1..."
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Tên kệ hàng *</label>
              <input
                type="text"
                required
                autoFocus
                className="input"
                placeholder="VD: Kệ A1 - Dãy gia vị & dầu ăn"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Vị trí / Mô tả chi tiết</label>
            <textarea
              rows="3"
              className="input"
              placeholder="VD: Dãy bên trái lối vào, tầng 2 gần quầy thu ngân..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Xem sản phẩm trên kệ */}
      <Modal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        size="lg"
        title={selectedShelf ? `Sản phẩm trên "${selectedShelf.name}"` : 'Chi tiết kệ hàng'}
        icon={<Layers size={20} className="text-sky-500" />}
        footer={
          <button type="button" onClick={() => setDetailModalOpen(false)} className="btn-secondary">
            Đóng
          </button>
        }
      >
        <div className="space-y-4">
          {selectedShelf && (
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-sky-500 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  {selectedShelf.description || 'Chưa có ghi chú vị trí'}
                </span>
              </div>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                Tổng: {shelfProducts.length} sản phẩm
              </span>
            </div>
          )}

          {loadingProducts ? (
            <SkeletonRows rows={4} cols={4} />
          ) : shelfProducts.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Box size={28} />
              </div>
              <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                Kệ hàng này hiện chưa có sản phẩm nào
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Bạn có thể gán vị trí kệ này cho sản phẩm khi thêm mới hoặc chỉnh sửa sản phẩm trong trang Sản phẩm.
              </p>
              <button
                onClick={() => {
                  setDetailModalOpen(false);
                  navigate('/products');
                }}
                className="btn-primary text-xs py-2 px-4 rounded-full mt-2"
              >
                Đến trang Sản phẩm <ExternalLink size={13} />
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider sticky top-0 z-10">
                    <th className="th">Mã SKU</th>
                    <th className="th">Tên sản phẩm</th>
                    <th className="th text-right">Giá bán</th>
                    <th className="th text-center">Tồn kho</th>
                    <th className="th text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {shelfProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="td font-mono font-bold text-slate-600 dark:text-slate-400">
                        {p.sku}
                      </td>
                      <td className="td font-bold text-slate-800 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-500 flex items-center justify-center shrink-0">
                            <Package size={13} />
                          </div>
                          <span className="line-clamp-1">{p.name}</span>
                        </div>
                      </td>
                      <td className="td text-right font-extrabold text-sky-600 dark:text-sky-400">
                        {formatCurrency(p.salePrice)}
                      </td>
                      <td className="td text-center">
                        <span className={`chip font-bold ${
                          p.currentStock <= 0 
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-500' 
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                        }`}>
                          {p.currentStock}
                        </span>
                      </td>
                      <td className="td text-right">
                        <button
                          onClick={() => {
                            setDetailModalOpen(false);
                            navigate(`/products?search=${encodeURIComponent(p.sku)}`);
                          }}
                          className="btn-secondary py-1 px-2.5 text-xs rounded-full"
                          title="Xem sản phẩm trong kho"
                        >
                          Xem chi tiết <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Shelves;
