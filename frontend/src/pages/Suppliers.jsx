import { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, Truck, History } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, EmptyState, Pagination, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/format';

const Suppliers = () => {
  const { toast, confirm } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  // History detail modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search.trim()) params.append('search', search.trim());
      const res = await api.get(`/suppliers?${params.toString()}`);
      setSuppliers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách nhà cung cấp'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchSuppliers, 300);
    return () => clearTimeout(timer);
  }, [search, page]);

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (s) => {
    setEditingSupplier(s);
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Vui lòng nhập tên nhà cung cấp');
    try {
      setSaving(true);
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.id}`, form);
        toast.success('Cập nhật nhà cung cấp thành công');
      } else {
        await api.post('/suppliers', form);
        toast.success('Thêm nhà cung cấp mới thành công');
      }
      setModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Có lỗi xảy ra'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s) => {
    const ok = await confirm({
      title: 'Xóa nhà cung cấp?',
      message: `Bạn có chắc muốn xóa nhà cung cấp "${s.name}"? Các phiếu nhập cũ sẽ được giữ lại.`,
      danger: true,
      confirmText: 'Xóa ngay'
    });
    if (!ok) return;

    try {
      await api.delete(`/suppliers/${s.id}`);
      toast.success('Đã xóa nhà cung cấp');
      fetchSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Xóa thất bại'));
    }
  };

  const handleViewHistory = async (s) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/suppliers/${s.id}`);
      setSelectedSupplier(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không tải được lịch sử nhập hàng'));
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        color="indigo"
        title="Quản lý nhà cung cấp"
        subtitle="Quản lý đối tác cung ứng hàng hóa, theo dõi các đợt nhập hàng"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={18} /> Thêm nhà cung cấp
          </button>
        }
      />

      <div className="card p-5 sm:p-6">
        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc số điện thoại..."
              className="input pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <span className="text-xs text-slate-400 font-medium self-end sm:self-center">
            {pagination?.total ? `Tổng cộng: ${pagination.total} đối tác` : ''}
          </span>
        </div>

        {/* Table / Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : suppliers.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Chưa có nhà cung cấp nào"
            description="Thêm nhà cung cấp để dễ dàng quản lý nguồn hàng và theo dõi công nợ nhập kho."
            action={
              <button onClick={handleOpenCreate} className="btn-primary">
                <Plus size={16} /> Thêm đối tác đầu tiên
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="th">Nhà cung cấp</th>
                  <th className="th">Số điện thoại</th>
                  <th className="th">Địa chỉ</th>
                  <th className="th text-center">Đợt nhập</th>
                  <th className="th text-right">Tổng tiền nhập</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="td font-bold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {s.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{s.name}</p>
                          {s.email && <p className="text-xs text-slate-400 flex items-center gap-1"><Mail size={12} /> {s.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="td text-slate-600">
                      {s.phone ? (
                        <span className="flex items-center gap-1.5 font-medium">
                          <Phone size={14} className="text-slate-400" /> {s.phone}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">Chưa có</span>
                      )}
                    </td>
                    <td className="td text-slate-500">
                      {s.address ? (
                        <span className="flex items-center gap-1 truncate max-w-xs" title={s.address}>
                          <MapPin size={14} className="text-slate-400 shrink-0" /> {s.address}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">-</span>
                      )}
                    </td>
                    <td className="td text-center">
                      <span className="chip bg-indigo-50 text-indigo-600 font-bold">
                        {s.purchaseCount || 0} lần
                      </span>
                    </td>
                    <td className="td text-right font-bold text-slate-800">
                      {formatCurrency(s.totalPurchased || 0)}
                    </td>
                    <td className="td text-right space-x-1">
                      <button
                        onClick={() => handleViewHistory(s)}
                        className="icon-btn text-indigo-500 hover:bg-indigo-50"
                        title="Xem lịch sử nhập hàng"
                      >
                        <History size={17} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(s)}
                        className="icon-btn text-amber-500 hover:bg-amber-50"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={17} />
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        className="icon-btn text-rose-500 hover:bg-rose-50"
                        title="Xóa nhà cung cấp"
                      >
                        <Trash2 size={17} />
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

      {/* Modal Thêm / Sửa nhà cung cấp */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? 'Chỉnh sửa nhà cung cấp' : 'Thêm nhà cung cấp mới'}
        icon={<Building2 size={20} className="text-indigo-500" />}
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" form="supplier-form" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : (editingSupplier ? 'Lưu thay đổi' : 'Thêm nhà cung cấp')}
            </button>
          </>
        }
      >
        <form id="supplier-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Tên nhà cung cấp *</label>
            <input
              type="text"
              required
              autoFocus
              className="input"
              placeholder="VD: Công ty TNHH Phân phối ABC..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Số điện thoại liên hệ</label>
              <input
                type="tel"
                className="input"
                placeholder="0912 345 678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email liên hệ</label>
              <input
                type="email"
                className="input"
                placeholder="contact@nhacungcap.vn"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Địa chỉ kho / trụ sở</label>
            <input
              type="text"
              className="input"
              placeholder="Số nhà, đường, quận/huyện, tỉnh thành..."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Lịch sử nhập hàng */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Lịch sử nhập hàng: ${selectedSupplier?.name || ''}`}
        icon={<History size={20} className="text-indigo-500" />}
        size="lg"
      >
        {historyLoading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Số điện thoại</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedSupplier?.phone || 'Chưa có'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Số lần nhập</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedSupplier?.purchases?.length || 0} đợt</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-indigo-600">Tổng tiền đã nhập</p>
                <p className="font-bold text-indigo-600 mt-0.5">{formatCurrency(selectedSupplier?.totalPurchased || 0)}</p>
              </div>
            </div>

            <h4 className="font-bold text-slate-800 text-sm pt-2">Danh sách phiếu nhập gần đây</h4>
            {(!selectedSupplier?.purchases || selectedSupplier.purchases.length === 0) ? (
              <p className="text-sm text-slate-400 py-6 text-center">Chưa có phiếu nhập nào từ nhà cung cấp này.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                {selectedSupplier.purchases.map((p) => (
                  <div key={p.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between text-sm transition-colors">
                    <div>
                      <span className="font-bold text-sky-600">{p.code}</span>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{formatCurrency(p.totalAmount)}</p>
                      {p.note && <p className="text-[11px] text-slate-400 truncate max-w-xs">{p.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Suppliers;
