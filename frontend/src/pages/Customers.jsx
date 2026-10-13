import { useState, useEffect } from 'react';
import { Users, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, ShoppingBag, Eye, History, ArrowRight } from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, EmptyState, Pagination, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/format';

const Customers = () => {
  const { toast, confirm } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  // History detail modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search.trim()) params.append('search', search.trim());
      const res = await api.get(`/customers?${params.toString()}`);
      setCustomers(res.data.data || []);
      setPagination(res.data.pagination);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi tải danh sách khách hàng'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(timer);
  }, [search, page]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setForm({ name: '', phone: '', email: '', address: '' });
    setModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.warning('Vui lòng nhập tên khách hàng');
    try {
      setSaving(true);
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, form);
        toast.success('Cập nhật thông tin khách hàng thành công');
      } else {
        await api.post('/customers', form);
        toast.success('Thêm khách hàng mới thành công');
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Có lỗi xảy ra'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    const ok = await confirm({
      title: 'Xóa khách hàng?',
      message: `Bạn có chắc muốn xóa khách hàng "${c.name}"? Lịch sử hóa đơn cũ của khách này vẫn sẽ được giữ lại.`,
      danger: true,
      confirmText: 'Xóa ngay'
    });
    if (!ok) return;

    try {
      await api.delete(`/customers/${c.id}`);
      toast.success('Đã xóa khách hàng');
      fetchCustomers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Xóa thất bại'));
    }
  };

  const handleViewHistory = async (c) => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/customers/${c.id}`);
      setSelectedCustomer(res.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không tải được lịch sử khách hàng'));
      setHistoryOpen(false);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        color="sky"
        title="Quản lý khách hàng"
        subtitle="Theo dõi thông tin, tổng chi tiêu và lịch sử mua sắm của khách hàng"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={18} /> Thêm khách hàng
          </button>
        }
      />

      <div className="card p-5 sm:p-6">
        {/* Search Bar */}
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
            {pagination?.total ? `Tổng cộng: ${pagination.total} khách hàng` : ''}
          </span>
        </div>

        {/* Table or Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={5} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có khách hàng nào"
            description="Lưu thông tin khách hàng giúp bạn tích điểm, theo dõi công nợ và chăm sóc khách hàng tốt hơn."
            action={
              <button onClick={handleOpenCreate} className="btn-primary">
                <Plus size={16} /> Thêm khách hàng đầu tiên
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="th">Khách hàng</th>
                  <th className="th">Số điện thoại</th>
                  <th className="th">Địa chỉ</th>
                  <th className="th text-center">Đơn hàng</th>
                  <th className="th text-right">Tổng chi tiêu</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="td font-bold text-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-sm shrink-0">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{c.name}</p>
                          {c.email && <p className="text-xs text-slate-400 flex items-center gap-1"><Mail size={12} /> {c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="td text-slate-600">
                      {c.phone ? (
                        <span className="flex items-center gap-1.5 font-medium">
                          <Phone size={14} className="text-slate-400" /> {c.phone}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">Chưa có</span>
                      )}
                    </td>
                    <td className="td text-slate-500">
                      {c.address ? (
                        <span className="flex items-center gap-1 truncate max-w-xs" title={c.address}>
                          <MapPin size={14} className="text-slate-400 shrink-0" /> {c.address}
                        </span>
                      ) : (
                        <span className="text-slate-300 italic">-</span>
                      )}
                    </td>
                    <td className="td text-center">
                      <span className="chip bg-sky-50 text-sky-600 font-bold">
                        {c.orderCount || 0} đơn
                      </span>
                    </td>
                    <td className="td text-right font-bold text-emerald-600">
                      {formatCurrency(c.totalSpent || 0)}
                    </td>
                    <td className="td text-right space-x-1">
                      <button
                        onClick={() => handleViewHistory(c)}
                        className="icon-btn text-sky-500 hover:bg-sky-50"
                        title="Xem lịch sử mua hàng"
                      >
                        <History size={17} />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="icon-btn text-amber-500 hover:bg-amber-50"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={17} />
                      </button>
                      <button
                        onClick={() => handleDelete(c)}
                        className="icon-btn text-rose-500 hover:bg-rose-50"
                        title="Xóa khách hàng"
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

      {/* Modal Thêm / Sửa khách hàng */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Chỉnh sửa khách hàng' : 'Thêm khách hàng mới'}
        icon={<Users size={20} className="text-sky-500" />}
        footer={
          <>
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" form="customer-form" disabled={saving} className="btn-primary">
              {saving ? 'Đang lưu...' : (editingCustomer ? 'Lưu thay đổi' : 'Thêm khách hàng')}
            </button>
          </>
        }
      >
        <form id="customer-form" onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Tên khách hàng *</label>
            <input
              type="text"
              required
              autoFocus
              className="input"
              placeholder="VD: Anh Minh, Chị Lan..."
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Số điện thoại</label>
              <input
                type="tel"
                className="input"
                placeholder="0912 345 678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="khachhang@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Địa chỉ</label>
            <input
              type="text"
              className="input"
              placeholder="Số nhà, tên đường, khu vực..."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Lịch sử mua hàng */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Lịch sử mua hàng: ${selectedCustomer?.name || ''}`}
        icon={<History size={20} className="text-sky-500" />}
        size="lg"
      >
        {historyLoading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : (
          <div className="space-y-4">
            {/* Thống kê nhanh */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Số điện thoại</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedCustomer?.phone || 'Chưa có'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Tổng số đơn</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedCustomer?.sales?.length || 0} đơn</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-emerald-600">Tổng chi tiêu</p>
                <p className="font-bold text-emerald-600 mt-0.5">{formatCurrency(selectedCustomer?.totalSpent || 0)}</p>
              </div>
            </div>

            {/* Danh sách hóa đơn */}
            <h4 className="font-bold text-slate-800 text-sm pt-2">Danh sách hóa đơn đã mua</h4>
            {(!selectedCustomer?.sales || selectedCustomer.sales.length === 0) ? (
              <p className="text-sm text-slate-400 py-6 text-center">Khách hàng này chưa phát sinh hóa đơn nào.</p>
            ) : (
              <div className="overflow-x-auto max-h-72 divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                {selectedCustomer.sales.map((s) => (
                  <div key={s.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between text-sm transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600">{s.code}</span>
                        <span className={`chip ${s.status === 'CANCELLED' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-600'}`}>
                          {s.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn thành'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(s.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">{formatCurrency(s.finalAmount)}</p>
                      {Number(s.discount) > 0 && <p className="text-[11px] text-red-500">Giảm: -{formatCurrency(s.discount)}</p>}
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

export default Customers;
