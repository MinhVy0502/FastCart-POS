import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const ICONS = {
  success: { Icon: CheckCircle2, cls: 'text-emerald-500 bg-emerald-50' },
  error: { Icon: XCircle, cls: 'text-rose-500 bg-rose-50' },
  warning: { Icon: AlertTriangle, cls: 'text-amber-500 bg-amber-50' },
  info: { Icon: Info, cls: 'text-sky-500 bg-sky-50' }
};

/**
 * Cung cấp:
 *  - toast.success / error / warning / info (thông báo góc màn hình)
 *  - confirm({ title, message, confirmText, danger, input }) → Promise<boolean | string>
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback((type, message, duration = 3000) => {
    const id = ++idRef.current;
    setToasts((t) => [...t.slice(-4), { id, type, message }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  const toast = useRef({}).current;
  toast.success = (m, d) => push('success', m, d);
  toast.error = (m, d) => push('error', m, d ?? 4500);
  toast.warning = (m, d) => push('warning', m, d ?? 4000);
  toast.info = (m, d) => push('info', m, d);

  const confirm = useCallback((opts) => new Promise((resolve) => {
    setInputValue('');
    setDialog({ ...opts, resolve });
  }), []);

  const closeDialog = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none">
        {toasts.map(({ id, type, message }) => {
          const { Icon, cls } = ICONS[type];
          return (
            <div key={id} className="pointer-events-auto flex items-start gap-3 bg-white border border-slate-100 shadow-xl shadow-slate-900/10 rounded-2xl p-3.5 animate-toast-in">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${cls}`}><Icon size={18} /></div>
              <p className="text-sm text-slate-700 font-medium flex-1 pt-1.5 leading-snug">{message}</p>
              <button onClick={() => remove(id)} className="text-slate-300 hover:text-slate-500 p-1"><X size={16} /></button>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {dialog && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm animate-fade-in" onClick={() => closeDialog(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 animate-pop-in">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${dialog.danger ? 'bg-rose-50 text-rose-500' : 'bg-sky-50 text-sky-500'}`}>
              {dialog.danger ? <AlertTriangle size={24} /> : <Info size={24} />}
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">{dialog.title || 'Xác nhận'}</h3>
            {dialog.message && <p className="text-sm text-slate-500 mb-4 whitespace-pre-line">{dialog.message}</p>}
            {dialog.input && (
              <input
                autoFocus
                className="input mb-4"
                placeholder={dialog.input.placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && closeDialog(inputValue || true)}
              />
            )}
            <div className="flex gap-3 mt-2">
              <button onClick={() => closeDialog(false)} className="btn-secondary flex-1">{dialog.cancelText || 'Hủy'}</button>
              <button
                autoFocus={!dialog.input}
                onClick={() => closeDialog(dialog.input ? (inputValue || true) : true)}
                className={`flex-1 ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
              >
                {dialog.confirmText || 'Đồng ý'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
};
