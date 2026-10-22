import { useState, useEffect } from 'react';
import { 
  Users, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, 
  ShoppingBag, History, Store, CreditCard, DollarSign, AlertTriangle, 
  ArrowUpRight, ArrowDownLeft, CheckCircle2, ChevronRight, FileText
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, MoneyInput, EmptyState, Pagination, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/format';

const Customers = () => {
  const { toast, confirm } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'WHOLESALE' | 'RETAIL' | 'DEBT'
  const [page, setPage] = useState(1);

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({
    name: '',
    customerType: 'RETAIL',
    storeName: '',
    phone: '',
    email: '',
    address: '',
    debtLimit: 0
  });
  const [saving, setSaving] = useState(false);

  // Detail / History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [historyTab, setHistoryTab] = useState('sales'); // 'sales' | 'debts'
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pay Debt Modal (Thu tiền nợ)
  const [payDebtOpen, setPayDebtOpen] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search.trim()) params.append('search', search.trim());
      if (filterType === 'WHOLESALE') params.append('customerType', 'WHOLESALE');
      if (filterType === 'RETAIL') params.append('customerType', 'RETAIL');
      if (filterType === 'DEBT') params.append('hasDebt', 'true');

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
  }, [search, filterType, page]);

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setForm({
      name: '',
      customerType: 'RETAIL',
      storeName: '',
      phone: '',
      email: '',
      address: '',
      debtLimit: 0
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (c) => {
    setEditingCustomer(c);
    setForm({
      name: c.name || '',
      customerType: c.customerType || 'RETAIL',
      storeName: c.storeName || '',
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      debtLimit: Number(c.debtLimit) || 0
    });
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
      toast.error(getErrorMessage(err, 'Có lỗi xảy ra khi lưu khách hàng'));
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

  const handleViewHistory = async (c, tab = 'sales') => {
    setHistoryTab(tab);
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

  const handleOpenPayDebt = (c) => {
    setPayingCustomer(c);
    setPayAmount(Number(c.currentDebt) || 0);
    setPayMethod('CASH');
    setPayNote(`Thu nợ tiệm ${c.storeName || c.name}`);
    setPayDebtOpen(true);
  };

  const handleSubmitPayDebt = async (e) => {
    e.preventDefault();
    if (!payingCustomer) return;
    if (payAmount <= 0) return toast.warning('Số tiền thanh toán phải lớn hơn 0');
    if (payAmount > Number(payingCustomer.currentDebt)) {
      return toast.warning('Số tiền thu vượt quá số nợ hiện tại');
    }

    try {
      setPaying(true);
      await api.post(`/customers/${payingCustomer.id}/pay-debt`, {
        amount: payAmount,
        paymentMethod: payMethod,
        note: payNote
      });
      toast.success(`Đã thu ${formatCurrency(payAmount)} công nợ thành công!`);
      setPayDebtOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi ghi nhận thu nợ'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        color="sky"
        title="Quản lý khách hàng & Đại lý"
        subtitle="Quản lý danh bạ khách lẻ, tiệm tạp hóa mua sỉ, hạn mức nợ và thu hồi công nợ"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={18} /> Thêm khách hàng
          </button>
        }
      />

      <div className="card p-5 sm:p-6 space-y-4">
        {/* Toolbar & Filters */}
        <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Tìm theo tên khách, tên tiệm, SĐT..."
              className="input pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setFilterType('ALL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'ALL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => { setFilterType('WHOLESALE'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${filterType === 'WHOLESALE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-indigo-600'}`}
              >
                <Store size={13} /> Đại lý / Sỉ
              </button>
              <button
                type="button"
                onClick={() => { setFilterType('RETAIL'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${filterType === 'RETAIL' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Khách lẻ
              </button>
              <button
                type="button"
                onClick={() => { setFilterType('DEBT'); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${filterType === 'DEBT' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-rose-500'}`}
              >
                <CreditCard size={13} /> Đang nợ
              </button>
            </div>

            <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-auto">
              {pagination?.total ? `Tổng ${pagination.total} khách` : ''}
            </span>
          </div>
        </div>

        {/* Table or Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
        ) : customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa tìm thấy khách hàng nào"
            description="Tạo danh sách khách lẻ hoặc các tiệm tạp hóa mua sỉ để tự động áp dụng giá sỉ và theo dõi nợ gối đầu."
            action={
              <button onClick={handleOpenCreate} className="btn-primary">
                <Plus size={16} /> Thêm khách hàng mới
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="th">Khách hàng / Tiệm tạp hóa</th>
                  <th className="th">Phân loại</th>
                  <th className="th">Liên hệ & Địa chỉ</th>
                  <th className="th text-right">Tổng chi tiêu</th>
                  <th className="th text-right">Công nợ hiện tại</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {customers.map((c) => {
                  const debt = Number(c.currentDebt) || 0;
                  const limit = Number(c.debtLimit) || 0;
                  const isExceeded = limit > 0 && debt > limit;
                  const isWholesale = c.customerType === 'WHOLESALE';

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="td font-bold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${isWholesale ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-sky-50 text-sky-600'}`}>
                            {isWholesale ? <Store size={20} /> : c.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-800">{c.name}</p>
                            </div>
                            {c.storeName ? (
                              <p className="text-xs text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                                <Store size={12} /> {c.storeName}
                              </p>
                            ) : (
                              c.email && <p className="text-xs text-slate-400 flex items-center gap-1"><Mail size={12} /> {c.email}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        {isWholesale ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-100">
                            <Store size={12} /> Đại lý / Sỉ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                            Khách lẻ
                          </span>
                        )}
                      </td>
                      <td className="td text-slate-600 text-xs">
                        <div className="space-y-1">
                          {c.phone ? (
                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                              <Phone size={13} className="text-slate-400" /> {c.phone}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">Chưa có SĐT</span>
                          )}
                          {c.address && (
                            <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs" title={c.address}>
                              <MapPin size={12} className="text-slate-400 shrink-0" /> {c.address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-right font-bold text-emerald-600">
                        {formatCurrency(c.totalSpent || 0)}
                        <p className="text-[11px] text-slate-400 font-normal">{c.orderCount || 0} đơn hàng</p>
                      </td>
                      <td className="td text-right">
                        {debt > 0 ? (
                          <div>
                            <span className="font-black text-rose-600 text-sm">
                              {formatCurrency(debt)}
                            </span>
                            {limit > 0 && (
                              <p className={`text-[11px] font-medium mt-0.5 ${isExceeded ? 'text-rose-600 font-bold flex items-center justify-end gap-1' : 'text-slate-400'}`}>
                                {isExceeded && <AlertTriangle size={11} />}
                                Hạn mức: {formatCurrency(limit)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">0₫ (Không nợ)</span>
                        )}
                      </td>
                      <td className="td text-right space-x-1">
                        {debt > 0 && (
                          <button
                            onClick={() => handleOpenPayDebt(c)}
                            className="btn-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1.5 rounded-xl transition-all"
                            title="Thu tiền nợ"
                          >
                            <DollarSign size={14} /> Thu nợ
                          </button>
                        )}
                        <button
                          onClick={() => handleViewHistory(c, debt > 0 ? 'debts' : 'sales')}
                          className="icon-btn text-sky-500 hover:bg-sky-50"
                          title="Lịch sử mua & sổ công nợ"
                        >
                          <History size={17} />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(c)}
                          className="icon-btn text-amber-500 hover:bg-amber-50"
                          title="Chỉnh sửa thông tin"
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
                  );
                })}
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
        title={editingCustomer ? 'Chỉnh sửa thông tin khách hàng' : 'Thêm khách hàng / Đại lý mới'}
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
          {/* Phân loại khách hàng */}
          <div>
            <label className="label">Loại khách hàng</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, customerType: 'RETAIL' })}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${form.customerType === 'RETAIL' ? 'border-sky-500 bg-sky-50/50 text-sky-700 font-bold ring-2 ring-sky-200' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                <Users size={18} className={form.customerType === 'RETAIL' ? 'text-sky-600' : 'text-slate-400'} />
                <div>
                  <p className="text-xs font-bold">Khách mua lẻ</p>
                  <p className="text-[11px] text-slate-400 font-normal">Áp dụng giá bán lẻ tiêu chuẩn</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, customerType: 'WHOLESALE' })}
                className={`p-3 rounded-2xl border text-left flex items-center gap-2.5 transition-all ${form.customerType === 'WHOLESALE' ? 'border-indigo-500 bg-indigo-50/50 text-indigo-700 font-bold ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
              >
                <Store size={18} className={form.customerType === 'WHOLESALE' ? 'text-indigo-600' : 'text-slate-400'} />
                <div>
                  <p className="text-xs font-bold">Đại lý / Tiệm tạp hóa</p>
                  <p className="text-[11px] text-slate-400 font-normal">Tự động áp dụng giá bán sỉ</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Tên người đại diện / Khách hàng *</label>
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

            <div>
              <label className="label">
                Tên cửa hàng / Tiệm tạp hóa {form.customerType === 'WHOLESALE' && <span className="text-indigo-600 font-bold">(Ưu tiên)</span>}
              </label>
              <input
                type="text"
                className="input"
                placeholder="VD: Tạp hóa Hoàng Phát, Đại lý Bảy Hiền..."
                value={form.storeName}
                onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              />
            </div>
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
            <label className="label">Địa chỉ giao hàng</label>
            <input
              type="text"
              className="input"
              placeholder="Số nhà, tên đường, khu vực..."
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {/* Hạn mức công nợ */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
            <label className="label flex items-center justify-between">
              <span className="font-bold text-slate-700">Hạn mức nợ cho phép (VNĐ)</span>
              <span className="text-[11px] text-slate-400 font-normal">Đặt 0 nếu không giới hạn</span>
            </label>
            <MoneyInput
              value={form.debtLimit}
              onChange={(val) => setForm({ ...form, debtLimit: val })}
              placeholder="VD: 10,000,000"
            />
            <p className="text-[11px] text-slate-400">
              Hệ thống sẽ nhắc nhở cảnh báo khi đơn hàng mới khiến tổng nợ vượt qua hạn mức này.
            </p>
          </div>
        </form>
      </Modal>

      {/* Modal Thu tiền nợ (Pay Debt Modal) */}
      <Modal
        open={payDebtOpen}
        onClose={() => setPayDebtOpen(false)}
        title="Thu tiền công nợ khách hàng"
        icon={<DollarSign size={20} className="text-emerald-500" />}
        footer={
          <>
            <button type="button" onClick={() => setPayDebtOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" form="pay-debt-form" disabled={paying} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
              {paying ? 'Đang xử lý...' : 'Xác nhận thu nợ'}
            </button>
          </>
        }
      >
        <form id="pay-debt-form" onSubmit={handleSubmitPayDebt} className="space-y-4">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-500 font-semibold">Khách hàng / Tiệm</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">
                {payingCustomer?.name} {payingCustomer?.storeName ? `(${payingCustomer.storeName})` : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-rose-500 font-semibold">Số nợ hiện tại</p>
              <p className="font-black text-rose-600 text-lg mt-0.5">
                {formatCurrency(payingCustomer?.currentDebt || 0)}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Số tiền thu nợ (VNĐ) *</label>
              <button
                type="button"
                onClick={() => setPayAmount(Number(payingCustomer?.currentDebt) || 0)}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                Thu toàn bộ nợ
              </button>
            </div>
            <MoneyInput
              value={payAmount}
              onChange={setPayAmount}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Hình thức thanh toán</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPayMethod('CASH')}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${payMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' : 'border-slate-200 text-slate-600'}`}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPayMethod('TRANSFER')}
                className={`p-3 rounded-2xl border text-center font-bold text-xs transition-all ${payMethod === 'TRANSFER' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-200' : 'border-slate-200 text-slate-600'}`}
              >
                Chuyển khoản / VietQR
              </button>
            </div>
          </div>

          <div>
            <label className="label">Ghi chú thu nợ</label>
            <input
              type="text"
              className="input"
              placeholder="VD: Trả nợ đợt 1 tiền hàng tuần trước..."
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Lịch sử mua hàng & Sổ công nợ chi tiết */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Chi tiết: ${selectedCustomer?.name || ''} ${selectedCustomer?.storeName ? `– ${selectedCustomer.storeName}` : ''}`}
        icon={<History size={20} className="text-sky-500" />}
        size="lg"
      >
        {historyLoading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : (
          <div className="space-y-4">
            {/* Thống kê nhanh */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Số điện thoại</p>
                <p className="font-semibold text-slate-800 mt-0.5 text-xs sm:text-sm">{selectedCustomer?.phone || 'Chưa có'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Tổng số đơn</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedCustomer?.sales?.length || 0} đơn</p>
              </div>
              <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-100">
                <p className="text-xs text-emerald-600 font-semibold">Tổng chi tiêu</p>
                <p className="font-bold text-emerald-600 mt-0.5">{formatCurrency(selectedCustomer?.totalSpent || 0)}</p>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                <p className="text-xs text-rose-600 font-semibold">Dư nợ hiện tại</p>
                <p className="font-black text-rose-600 mt-0.5">{formatCurrency(selectedCustomer?.currentDebt || 0)}</p>
              </div>
            </div>

            {/* Tab switch */}
            <div className="flex border-b border-slate-100 gap-6">
              <button
                type="button"
                onClick={() => setHistoryTab('sales')}
                className={`pb-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${historyTab === 'sales' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <ShoppingBag size={16} /> Lịch sử hóa đơn ({selectedCustomer?.sales?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('debts')}
                className={`pb-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${historyTab === 'debts' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <CreditCard size={16} /> Sổ công nợ chi tiết ({selectedCustomer?.debts?.length || 0})
              </button>
            </div>

            {/* Tab Content: Sales */}
            {historyTab === 'sales' && (
              <div>
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
                            <span className="text-[11px] font-semibold text-slate-400">
                              {s.paymentMethod === 'DEBT' ? 'Ghi nợ' : s.paymentMethod === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
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

            {/* Tab Content: Debts */}
            {historyTab === 'debts' && (
              <div>
                {(!selectedCustomer?.debts || selectedCustomer.debts.length === 0) ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Chưa có bản ghi biến động nợ nào.</p>
                ) : (
                  <div className="overflow-x-auto max-h-72 divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                    {selectedCustomer.debts.map((d) => {
                      const isIncrease = d.type === 'INCREASE';
                      return (
                        <div key={d.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between text-sm transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 mt-0.5 ${isIncrease ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {isIncrease ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${isIncrease ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                  {isIncrease ? 'Mua nợ (+)' : 'Trả nợ (-)'}
                                </span>
                                {d.referenceCode && (
                                  <span className="font-mono text-xs font-bold text-slate-600">
                                    {d.referenceCode}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">{d.note || '-'}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(d.createdAt)}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-black ${isIncrease ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {isIncrease ? `+${formatCurrency(d.amount)}` : `-${formatCurrency(d.amount)}`}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              Dư nợ sau GD: <span className="font-bold text-slate-600">{formatCurrency(d.balanceAfter)}</span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Customers;
