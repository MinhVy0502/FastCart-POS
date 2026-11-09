import { useState, useEffect } from 'react';
import { 
  Building2, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, 
  Truck, History, DollarSign, CreditCard, ArrowUpRight, ArrowDownLeft 
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../contexts/ToastContext';
import { PageHeader, Modal, MoneyInput, EmptyState, Pagination, SkeletonRows } from '../components/ui';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/format';

const Suppliers = () => {
  const { toast, confirm } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [search, setSearch] = useState('');
  const [filterDebt, setFilterDebt] = useState(false);
  const [page, setPage] = useState(1);

  // Modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [saving, setSaving] = useState(false);

  // History detail modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [historyTab, setHistoryTab] = useState('purchases'); // 'purchases' | 'debts'
  const [historyLoading, setHistoryLoading] = useState(false);

  // Pay Supplier Debt Modal (Thanh toán nợ NCC)
  const [payDebtOpen, setPayDebtOpen] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('CASH');
  const [payNote, setPayNote] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '15' });
      if (search.trim()) params.append('search', search.trim());
      if (filterDebt) params.append('hasDebt', 'true');
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
  }, [search, filterDebt, page]);

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

  const handleViewHistory = async (s, tab = 'purchases') => {
    setHistoryTab(tab);
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

  const handleOpenPayDebt = (s) => {
    setPayingSupplier(s);
    setPayAmount(Number(s.currentDebt) || 0);
    setPayMethod('CASH');
    setPayNote(`Thanh toán công nợ cho NCC ${s.name}`);
    setPayDebtOpen(true);
  };

  const handleSubmitPayDebt = async (e) => {
    e.preventDefault();
    if (!payingSupplier) return;
    if (payAmount <= 0) return toast.warning('Số tiền thanh toán phải lớn hơn 0');
    if (payAmount > Number(payingSupplier.currentDebt)) {
      return toast.warning('Số tiền chi trả vượt quá nợ cần trả hiện tại');
    }

    try {
      setPaying(true);
      await api.post(`/suppliers/${payingSupplier.id}/pay-debt`, {
        amount: payAmount,
        paymentMethod: payMethod,
        note: payNote
      });
      toast.success(`Đã thanh toán ${formatCurrency(payAmount)} cho nhà cung cấp!`);
      setPayDebtOpen(false);
      fetchSuppliers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lỗi thanh toán công nợ NCC'));
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        color="indigo"
        title="Quản lý nhà cung cấp"
        subtitle="Quản lý đối tác cung ứng hàng hóa, theo dõi các đợt nhập hàng và công nợ phải trả"
        actions={
          <button onClick={handleOpenCreate} className="btn-primary">
            <Plus size={18} /> Thêm nhà cung cấp
          </button>
        }
      />

      <div className="card p-5 sm:p-6">
        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
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

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setFilterDebt(false); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all ${!filterDebt ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => { setFilterDebt(true); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${filterDebt ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-rose-500'}`}
              >
                <CreditCard size={13} /> Đang nợ NCC
              </button>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              {pagination?.total ? `Tổng: ${pagination.total} đối tác` : ''}
            </span>
          </div>
        </div>

        {/* Table / Empty State */}
        {loading ? (
          <SkeletonRows rows={6} cols={6} />
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
            <table className="w-full text-left border-collapse min-w-[780px]">
              <thead>
                <tr className="bg-slate-50/75 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="th">Nhà cung cấp</th>
                  <th className="th">Liên hệ & Địa chỉ</th>
                  <th className="th text-center">Đợt nhập</th>
                  <th className="th text-right">Tổng tiền nhập</th>
                  <th className="th text-right">Nợ cần trả NCC</th>
                  <th className="th text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {suppliers.map((s) => {
                  const debt = Number(s.currentDebt) || 0;
                  return (
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
                      <td className="td text-slate-600 text-xs">
                        <div className="space-y-1">
                          {s.phone ? (
                            <span className="flex items-center gap-1.5 font-medium text-slate-700">
                              <Phone size={13} className="text-slate-400" /> {s.phone}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">Chưa có SĐT</span>
                          )}
                          {s.address && (
                            <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs" title={s.address}>
                              <MapPin size={12} className="text-slate-400 shrink-0" /> {s.address}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-center">
                        <span className="chip bg-indigo-50 text-indigo-600 font-bold">
                          {s.purchaseCount || 0} lần
                        </span>
                      </td>
                      <td className="td text-right font-bold text-slate-800">
                        {formatCurrency(s.totalPurchased || 0)}
                      </td>
                      <td className="td text-right">
                        {debt > 0 ? (
                          <span className="font-black text-rose-600 text-sm">{formatCurrency(debt)}</span>
                        ) : (
                          <span className="text-xs text-slate-400">0₫ (Đã tất toán)</span>
                        )}
                      </td>
                      <td className="td text-right space-x-1">
                        {debt > 0 && (
                          <button
                            onClick={() => handleOpenPayDebt(s)}
                            className="btn-sm bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 inline-flex items-center gap-1 font-bold text-xs px-2.5 py-1.5 rounded-xl transition-all"
                            title="Thanh toán nợ cho Nhà cung cấp"
                          >
                            <DollarSign size={14} /> Trả nợ
                          </button>
                        )}
                        <button
                          onClick={() => handleViewHistory(s, debt > 0 ? 'debts' : 'purchases')}
                          className="icon-btn text-indigo-500 hover:bg-indigo-50"
                          title="Xem lịch sử nhập hàng & sổ nợ NCC"
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
                  );
                })}
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

      {/* Modal Thanh toán công nợ NCC */}
      <Modal
        open={payDebtOpen}
        onClose={() => setPayDebtOpen(false)}
        title="Thanh toán nợ cho Nhà cung cấp"
        icon={<DollarSign size={20} className="text-emerald-500" />}
        footer={
          <>
            <button type="button" onClick={() => setPayDebtOpen(false)} className="btn-secondary">Hủy</button>
            <button type="submit" form="pay-supp-debt-form" disabled={paying} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
              {paying ? 'Đang xử lý...' : 'Xác nhận chi trả'}
            </button>
          </>
        }
      >
        <form id="pay-supp-debt-form" onSubmit={handleSubmitPayDebt} className="space-y-4">
          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-rose-500 font-semibold">Nhà cung cấp</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{payingSupplier?.name}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-rose-500 font-semibold">Nợ cần trả hiện tại</p>
              <p className="font-black text-rose-600 text-lg mt-0.5">{formatCurrency(payingSupplier?.currentDebt || 0)}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Số tiền chi trả (VNĐ) *</label>
              <button
                type="button"
                onClick={() => setPayAmount(Number(payingSupplier?.currentDebt) || 0)}
                className="text-xs text-emerald-600 font-bold hover:underline"
              >
                Tất toán toàn bộ
              </button>
            </div>
            <MoneyInput
              value={payAmount}
              onChange={setPayAmount}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Hình thức chi trả</label>
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
                Chuyển khoản ngân hàng
              </button>
            </div>
          </div>

          <div>
            <label className="label">Ghi chú phiếu chi</label>
            <input
              type="text"
              className="input"
              placeholder="VD: Thanh toán tiền hàng đợt nhập..."
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Lịch sử nhập hàng & Sổ công nợ NCC */}
      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Chi tiết NCC: ${selectedSupplier?.name || ''}`}
        icon={<History size={20} className="text-indigo-500" />}
        size="lg"
      >
        {historyLoading ? (
          <SkeletonRows rows={4} cols={4} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Số điện thoại</p>
                <p className="font-semibold text-slate-800 mt-0.5 text-xs sm:text-sm">{selectedSupplier?.phone || 'Chưa có'}</p>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-400">Số phiếu nhập</p>
                <p className="font-semibold text-slate-800 mt-0.5">{selectedSupplier?.purchases?.length || 0} phiếu</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-600 font-semibold">Tổng tiền đã nhập</p>
                <p className="font-bold text-indigo-600 mt-0.5">{formatCurrency(selectedSupplier?.totalPurchased || 0)}</p>
              </div>
              <div className="bg-rose-50 p-3 rounded-2xl border border-rose-100">
                <p className="text-xs text-rose-600 font-semibold">Nợ cần trả NCC</p>
                <p className="font-black text-rose-600 mt-0.5">{formatCurrency(selectedSupplier?.currentDebt || 0)}</p>
              </div>
            </div>

            <div className="flex border-b border-slate-100 gap-6">
              <button
                type="button"
                onClick={() => setHistoryTab('purchases')}
                className={`pb-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${historyTab === 'purchases' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <Truck size={16} /> Lịch sử phiếu nhập ({selectedSupplier?.purchases?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('debts')}
                className={`pb-2.5 text-sm font-bold border-b-2 transition-all flex items-center gap-1.5 ${historyTab === 'debts' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
              >
                <CreditCard size={16} /> Sổ công nợ NCC ({selectedSupplier?.debts?.length || 0})
              </button>
            </div>

            {historyTab === 'purchases' && (
              <div>
                {(!selectedSupplier?.purchases || selectedSupplier.purchases.length === 0) ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Chưa có phiếu nhập nào từ nhà cung cấp này.</p>
                ) : (
                  <div className="overflow-x-auto max-h-72 divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                    {selectedSupplier.purchases.map((p) => (
                      <div key={p.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between text-sm transition-colors">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sky-600">{p.code}</span>
                            <span className={`chip ${p.status === 'CANCELLED' ? 'bg-rose-50 text-rose-500' : 'bg-slate-100 text-slate-600'}`}>
                              {p.status === 'CANCELLED' ? 'Đã hủy' : 'Hoàn thành'}
                            </span>
                          </div>
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

            {historyTab === 'debts' && (
              <div>
                {(!selectedSupplier?.debts || selectedSupplier.debts.length === 0) ? (
                  <p className="text-sm text-slate-400 py-6 text-center">Chưa có bản ghi công nợ nào với nhà cung cấp này.</p>
                ) : (
                  <div className="overflow-x-auto max-h-72 divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                    {selectedSupplier.debts.map((d) => {
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
                                  {isIncrease ? 'Nợ nhập hàng (+)' : 'Trả nợ NCC (-)'}
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

export default Suppliers;
