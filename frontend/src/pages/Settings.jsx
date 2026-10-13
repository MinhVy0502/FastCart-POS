import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Settings as SettingsIcon, Store, Printer, QrCode, User, 
  KeyRound, Save, CheckCircle2, AlertCircle, Building2, Smartphone 
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useStore } from '../contexts/StoreContext';
import { useToast } from '../contexts/ToastContext';
import { PageHeader } from '../components/ui';
import { BANKS, vietQrUrl } from '../constants/banks';
import { getErrorMessage } from '../utils/format';

const Settings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'store';
  const [tab, setTab] = useState(initialTab);

  const { user } = useAuth();
  const { settings, refresh: refreshStore } = useStore();
  const { toast } = useToast();

  // Tab 1: Store & Print Form
  const [storeForm, setStoreForm] = useState({
    storeName: '',
    phone: '',
    address: '',
    receiptFooter: 'Cảm ơn quý khách và hẹn gặp lại!',
    paperSize: '80mm',
    bankBin: '',
    bankAccount: '',
    bankAccountName: ''
  });
  const [savingStore, setSavingStore] = useState(false);

  // Tab 2: Profile Form
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Tab 3: Password Form
  const [passForm, setPassForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [savingPass, setSavingPass] = useState(false);

  useEffect(() => {
    if (settings) {
      setStoreForm({
        storeName: settings.storeName || '',
        phone: settings.phone || '',
        address: settings.address || '',
        receiptFooter: settings.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!',
        paperSize: settings.paperSize || '80mm',
        bankBin: settings.bankBin || '',
        bankAccount: settings.bankAccount || '',
        bankAccountName: settings.bankAccountName || ''
      });
    }
  }, [settings]);

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const handleTabChange = (t) => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  const handleSaveStore = async (e) => {
    e.preventDefault();
    if (!storeForm.storeName.trim()) return toast.warning('Tên cửa hàng không được để trống');
    try {
      setSavingStore(true);
      await api.put('/settings', storeForm);
      toast.success('Đã lưu thông tin cửa hàng & cấu hình hóa đơn');
      refreshStore();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Lưu cài đặt thất bại'));
    } finally {
      setSavingStore(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      return toast.warning('Họ tên và email là bắt buộc');
    }
    try {
      setSavingProfile(true);
      await api.put('/auth/profile', profileForm);
      toast.success('Cập nhật thông tin cá nhân thành công');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Cập nhật thất bại'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (passForm.newPassword.length < 6) {
      return toast.warning('Mật khẩu mới phải có ít nhất 6 ký tự');
    }
    if (passForm.newPassword !== passForm.confirmPassword) {
      return toast.warning('Mật khẩu xác nhận không khớp');
    }
    try {
      setSavingPass(true);
      await api.put('/auth/password', {
        currentPassword: passForm.currentPassword,
        newPassword: passForm.newPassword
      });
      toast.success('Đổi mật khẩu thành công');
      setPassForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Đổi mật khẩu thất bại'));
    } finally {
      setSavingPass(false);
    }
  };

  const qrPreview = vietQrUrl(storeForm, 100000, 'HOADON123');

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        icon={SettingsIcon}
        color="violet"
        title="Cài đặt hệ thống"
        subtitle="Quản lý thông tin cửa hàng, mẫu in hóa đơn, tài khoản VietQR và bảo mật"
      />

      {/* Tabs */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 w-full max-w-md overflow-x-auto">
        <button
          onClick={() => handleTabChange('store')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            tab === 'store' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store size={16} /> Cửa hàng & In ấn
        </button>
        <button
          onClick={() => handleTabChange('profile')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            tab === 'profile' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <User size={16} /> Hồ sơ cá nhân
        </button>
        <button
          onClick={() => handleTabChange('security')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
            tab === 'security' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <KeyRound size={16} /> Đổi mật khẩu
        </button>
      </div>

      {/* TAB 1: CỬA HÀNG & IN ẤN & VIETQR */}
      {tab === 'store' && (
        <form onSubmit={handleSaveStore} className="space-y-6">
          <div className="card p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Store size={18} className="text-sky-500" /> Thông tin cơ sở kinh doanh
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Thông tin này sẽ hiển thị ở đầu hóa đơn bán hàng gửi cho khách.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Tên cửa hàng / Đại lý *</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="VD: Cửa hàng Tạp Hóa Thịnh Phát"
                  value={storeForm.storeName}
                  onChange={(e) => setStoreForm({ ...storeForm, storeName: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="VD: 0988 123 456"
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Địa chỉ kinh doanh</label>
                <input
                  type="text"
                  className="input"
                  placeholder="VD: 123 Nguyễn Văn Cừ, Quận 5, TP.HCM"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Printer size={18} className="text-sky-500" /> Cấu hình máy in hóa đơn
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Hệ thống hỗ trợ in nhiệt trực tiếp từ trình duyệt cho mọi loại máy in bill.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Khổ giấy in mặc định</label>
                <select
                  className="input"
                  value={storeForm.paperSize}
                  onChange={(e) => setStoreForm({ ...storeForm, paperSize: e.target.value })}
                >
                  <option value="80mm">Khổ K80 (80mm - Phổ biến cho máy in bill)</option>
                  <option value="58mm">Khổ K58 (58mm - Máy in nhiệt nhỏ cầm tay)</option>
                  <option value="A4">Khổ giấy A4 / A5 (Máy in văn phòng)</option>
                </select>
              </div>

              <div>
                <label className="label">Lời cảm ơn chân hóa đơn</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Cảm ơn quý khách và hẹn gặp lại!"
                  value={storeForm.receiptFooter}
                  onChange={(e) => setStoreForm({ ...storeForm, receiptFooter: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* VietQR Config */}
          <div className="card p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <QrCode size={18} className="text-emerald-500" /> Cấu hình mã QR chuyển khoản (VietQR)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Khi chọn thanh toán "Chuyển khoản", hệ thống sẽ tự động tạo mã QR có sẵn số tiền và nội dung đơn hàng để khách quét.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div>
                  <label className="label">Ngân hàng thụ hưởng</label>
                  <select
                    className="input"
                    value={storeForm.bankBin}
                    onChange={(e) => setStoreForm({ ...storeForm, bankBin: e.target.value })}
                  >
                    <option value="">-- Chưa kích hoạt VietQR --</option>
                    {BANKS.map((b) => (
                      <option key={b.bin} value={b.bin}>{b.name} (BIN: {b.bin})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Số tài khoản ngân hàng</label>
                    <input
                      type="text"
                      className="input font-mono"
                      placeholder="VD: 1903456789..."
                      value={storeForm.bankAccount}
                      onChange={(e) => setStoreForm({ ...storeForm, bankAccount: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label">Tên chủ tài khoản (không dấu)</label>
                    <input
                      type="text"
                      className="input uppercase"
                      placeholder="VD: NGUYEN VAN A"
                      value={storeForm.bankAccountName}
                      onChange={(e) => setStoreForm({ ...storeForm, bankAccountName: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              </div>

              {/* QR Preview */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col items-center justify-center text-center">
                <p className="text-xs font-bold text-slate-500 mb-2">Xem trước mã VietQR</p>
                {qrPreview ? (
                  <img src={qrPreview} alt="VietQR Preview" className="w-36 h-36 object-contain rounded-xl border border-slate-200 bg-white p-1" />
                ) : (
                  <div className="w-36 h-36 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 text-xs p-2">
                    Nhập ngân hàng & số TK để xem trước
                  </div>
                )}
                <span className="text-[11px] text-slate-400 mt-2">Hỗ trợ quét bằng mọi app ngân hàng</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={savingStore} className="btn-primary px-8">
              <Save size={18} /> {savingStore ? 'Đang lưu...' : 'Lưu tất cả cài đặt'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: HỒ SƠ CÁ NHÂN */}
      {tab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="card p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <User size={18} className="text-sky-500" /> Thông tin tài khoản quản trị
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Thông tin người dùng đang đăng nhập vào hệ thống.</p>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="label">Họ và tên *</label>
              <input
                type="text"
                required
                className="input"
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Địa chỉ Email *</label>
              <input
                type="email"
                required
                className="input"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Số điện thoại</label>
              <input
                type="tel"
                className="input"
                placeholder="0912 345 678"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              />
            </div>

            <button type="submit" disabled={savingProfile} className="btn-primary pt-2">
              <Save size={18} /> {savingProfile ? 'Đang lưu...' : 'Cập nhật hồ sơ'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: ĐỔI MẬT KHẨU */}
      {tab === 'security' && (
        <form onSubmit={handleSavePassword} className="card p-6 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <KeyRound size={18} className="text-amber-500" /> Đổi mật khẩu đăng nhập
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Đổi mật khẩu định kỳ để bảo vệ dữ liệu kinh doanh của cửa hàng.</p>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="label">Mật khẩu hiện tại *</label>
              <input
                type="password"
                required
                className="input"
                placeholder="Nhập mật khẩu đang dùng"
                value={passForm.currentPassword}
                onChange={(e) => setPassForm({ ...passForm, currentPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Mật khẩu mới * (tối thiểu 6 ký tự)</label>
              <input
                type="password"
                required
                className="input"
                placeholder="Nhập mật khẩu mới"
                value={passForm.newPassword}
                onChange={(e) => setPassForm({ ...passForm, newPassword: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Xác nhận mật khẩu mới *</label>
              <input
                type="password"
                required
                className="input"
                placeholder="Nhập lại mật khẩu mới"
                value={passForm.confirmPassword}
                onChange={(e) => setPassForm({ ...passForm, confirmPassword: e.target.value })}
              />
            </div>

            <button type="submit" disabled={savingPass} className="btn-primary pt-2">
              <Save size={18} /> {savingPass ? 'Đang xử lý...' : 'Xác nhận đổi mật khẩu'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default Settings;
