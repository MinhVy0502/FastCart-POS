import { useState, useEffect } from 'react';
import { Tags, Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, EmptyState, SkeletonRows } from '../components/ui';
import { getErrorMessage } from '../utils/format';

const Categories = () => {
  const { toast, confirm } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/categories');
      setCategories(res.data.data || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh mục'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setFormData({ name: category.name, description: category.description || '' });
    } else {
      setEditingCategory(null);
      setFormData({ name: '', description: '' });
    }
    setShowModal(true);
  };

  const closeModal = () => setShowModal(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return toast.warning('Tên danh mục là bắt buộc');
    try {
      setSaving(true);
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, formData);
        toast.success('Cập nhật danh mục thành công');
      } else {
        await api.post('/categories', formData);
        toast.success('Thêm danh mục mới thành công');
      }
      closeModal();
      fetchCategories();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lưu danh mục thất bại'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat) => {
    const ok = await confirm({
      title: 'Xóa danh mục?',
      message: `Bạn có chắc muốn xóa danh mục "${cat.name}"? Các sản phẩm thuộc danh mục này sẽ chuyển về trạng thái Chưa phân loại.`,
      danger: true,
      confirmText: 'Xóa ngay'
    });
    if (!ok) return;

    try {
      await api.delete(`/categories/${cat.id}`);
      toast.success('Đã xóa danh mục');
      fetchCategories();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Xóa danh mục thất bại'));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Tags}
        color="sky"
        title="Danh mục sản phẩm"
        subtitle="Phân loại hàng hóa giúp tìm kiếm và quản lý kho thuận tiện hơn"
        actions={
          <button onClick={() => openModal()} className="btn-primary">
            <Plus size={18} /> Thêm danh mục
          </button>
        }
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {loading ? (
          <SkeletonRows rows={5} cols={3} />
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title="Chưa có danh mục nào"
            description="Tạo các nhóm sản phẩm như Nước giải khát, Bánh kẹo, Đồ gia dụng..."
            action={
              <button onClick={() => openModal()} className="btn-primary">
                <Plus size={16} /> Thêm danh mục đầu tiên
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div 
                key={c.id} 
                className="card p-4 flex flex-col justify-between hover:border-sky-300 hover:shadow-md transition-all group"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold text-xs">
                      <Tags size={16} />
                    </span>
                    <div className="space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openModal(c)}
                        className="icon-btn text-amber-500 hover:bg-amber-50"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="icon-btn text-rose-500 hover:bg-rose-50"
                        title="Xóa danh mục"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">{c.name}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {c.description || 'Chưa có mô tả cho danh mục này'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Thêm / Sửa */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingCategory ? 'Chỉnh sửa danh mục' : 'Thêm danh mục mới'}
        icon={<Tags size={20} className="text-sky-500" />}
        footer={
          <>
            <button type="button" onClick={closeModal} className="btn-secondary">Hủy</button>
            <button type="submit" form="category-form" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : (editingCategory ? 'Lưu thay đổi' : 'Thêm danh mục')}
            </button>
          </>
        }
      >
        <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Tên danh mục *</label>
            <input
              type="text"
              required
              autoFocus
              className="input"
              placeholder="VD: Nước giải khát, Thực phẩm đông lạnh..."
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Mô tả danh mục</label>
            <textarea
              rows="3"
              className="input"
              placeholder="Nhập mô tả ngắn gọn..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Categories;
