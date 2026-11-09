import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';
import { ShoppingCart, Mail, Lock, User, Phone, UserPlus, AlertCircle, CheckCircle2, Sun, Moon } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/auth/register', formData);
      setSuccess('Đăng ký thành công! Đang chuyển hướng tới Đăng nhập...');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b15] relative overflow-hidden px-4 transition-colors">
      {/* Theme Toggle Button */}
      <button
        type="button"
        onClick={toggle}
        className="fixed top-5 right-5 z-20 flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 dark:bg-[#0e172a]/90 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:border-sky-400 transition-all text-xs font-semibold backdrop-blur"
        title={dark ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
      >
        {dark ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-600" />}
        <span>{dark ? 'Giao diện Sáng' : 'Giao diện Tối'}</span>
      </button>

      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-sky-400/20 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-sky-300/20 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-white dark:bg-[#0e172a] rounded-[32px] shadow-xl border border-slate-100 dark:border-slate-800 p-8 md:p-10 relative z-10 my-8 transition-colors">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-sky-100 dark:bg-sky-500/15 text-sky-500 dark:text-sky-400 rounded-2xl flex items-center justify-center mb-4">
            <ShoppingCart size={32} className="stroke-2" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Tạo Tài Khoản</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Hệ thống quản lý đại lý bán hàng</p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border-l-4 border-red-500 text-red-700 dark:text-red-300 p-4 rounded-xl flex items-start gap-3 mb-6 text-sm">
            <AlertCircle size={20} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-50 dark:bg-emerald-950/40 border-l-4 border-emerald-500 text-emerald-700 dark:text-emerald-300 p-4 rounded-xl flex items-start gap-3 mb-6 text-sm">
            <CheckCircle2 size={20} className="shrink-0" />
            <p>{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Họ và Tên</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
              <input
                type="text"
                name="name"
                required
                className="w-full bg-slate-50 dark:bg-[#080f1e] border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all"
                placeholder="Nguyễn Văn A"
                value={formData.name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
              <input
                type="email"
                name="email"
                required
                className="w-full bg-slate-50 dark:bg-[#080f1e] border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Số điện thoại</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
              <input
                type="tel"
                name="phone"
                required
                className="w-full bg-slate-50 dark:bg-[#080f1e] border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all"
                placeholder="0901234567"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Mật khẩu</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={20} />
              <input
                type="password"
                name="password"
                required
                className="w-full bg-slate-50 dark:bg-[#080f1e] border border-slate-200 dark:border-slate-700/80 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400 transition-all"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-sky-400 hover:bg-sky-500 text-white py-3.5 rounded-2xl font-semibold shadow-lg shadow-sky-400/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <UserPlus size={20} />
                Đăng ký tài khoản
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-sky-500 dark:text-sky-400 font-semibold hover:underline">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
