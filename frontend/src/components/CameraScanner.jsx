import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  X, Camera, SwitchCamera, Upload, AlertCircle, RefreshCw, 
  ArrowRight, ShieldAlert, Sparkles, CheckCircle2, Keyboard
} from 'lucide-react';

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E
];

/** Phát tiếng bíp chuẩn POS bằng Web Audio API (không cần file âm thanh ngoài) */
const playBeep = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) {
    // Không chặn luồng nếu audio bị chặn
  }
};

const CameraScanner = ({ onScan, onClose, title = 'Quét mã vạch & QR Code' }) => {
  const [cameras, setCameras] = useState([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [processingFile, setProcessingFile] = useState(false);
  const [lastScanned, setLastScanned] = useState(null);
  const [fileError, setFileError] = useState(null);

  const scannerRef = useRef(null);
  const fileInputRef = useRef(null);
  const isMountedRef = useRef(true);

  // Kiểm tra môi trường an toàn (HTTPS hoặc localhost)
  const isSecure = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const containerId = 'fastcart-qr-viewport';

  const handleScanSuccess = (decodedText) => {
    playBeep();
    setLastScanned(decodedText);
    if (onScan) {
      onScan(decodedText);
    }
    // Tự đóng sau 600ms khi quét thành công hoặc giữ để quét liên tiếp
    setTimeout(() => {
      if (isMountedRef.current) setLastScanned(null);
    }, 1500);
  };

  const startCamera = async (cameraIdOrConfig) => {
    if (!scannerRef.current) return;
    try {
      setIsStarting(true);
      setCameraError(null);

      // Nếu đang quét thì stop trước
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }

      const config = {
        fps: 12,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          return {
            width: Math.min(320, Math.floor(minEdge * 0.85)),
            height: Math.min(220, Math.floor(minEdge * 0.65))
          };
        },
        aspectRatio: 1.333333
      };

      await scannerRef.current.start(
        cameraIdOrConfig || { facingMode: 'environment' },
        config,
        (decodedText) => handleScanSuccess(decodedText),
        () => { /* bỏ qua lỗi từng frame */ }
      );

      if (isMountedRef.current) {
        setIsScanning(true);
        setIsStarting(false);
      }
    } catch (err) {
      console.warn('Lỗi bật camera:', err);
      if (isMountedRef.current) {
        setIsStarting(false);
        setIsScanning(false);

        const msg = String(err?.message || err || '');
        if (!isSecure) {
          setCameraError(
            'Trình duyệt hạn chế mở Camera trực tiếp khi truy cập qua mạng LAN (HTTP). Bạn hãy dùng nút "Chụp ảnh / Tải ảnh" bên dưới hoặc nhập mã thủ công.'
          );
        } else if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
          setCameraError('Bạn chưa cấp quyền truy cập Camera cho trang web. Vui lòng nhấn vào biểu tượng ổ khóa cạnh thanh địa chỉ để Bật quyền Camera.');
        } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
          setCameraError('Không tìm thấy thiết bị Camera / Webcam nào trên máy của bạn. Bạn có thể tải file ảnh mã vạch hoặc nhập mã thủ công.');
        } else if (msg.includes('NotReadableError') || msg.includes('TrackStartError')) {
          setCameraError('Camera đang bị ứng dụng khác sử dụng (Zoom, Zalo, Teams...). Vui lòng tắt ứng dụng kia và thử lại.');
        } else {
          setCameraError('Không thể khởi động Camera. Bạn có thể dùng tính năng Chụp ảnh hoặc Nhập mã.');
        }
      }
    }
  };

  // Khởi tạo máy quét
  useEffect(() => {
    isMountedRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const scannerInstance = new Html5Qrcode(containerId, {
          formatsToSupport: SUPPORTED_FORMATS,
          verbose: false
        });
        scannerRef.current = scannerInstance;

        // Lấy danh sách camera nếu có
        try {
          const deviceList = await Html5Qrcode.getCameras();
          if (isMountedRef.current && deviceList && deviceList.length > 0) {
            setCameras(deviceList);
          }
        } catch (e) {
          // getCameras có thể lỗi nếu chưa cấp quyền hoặc trên HTTP
        }

        // Bật camera ưu tiên camera sau
        await startCamera({ facingMode: 'environment' });
      } catch (err) {
        console.error('Lỗi khởi tạo Html5Qrcode:', err);
        if (isMountedRef.current) {
          setIsStarting(false);
          setCameraError('Không thể nạp trình quét. Bạn có thể chụp ảnh hoặc nhập mã vạch thủ công.');
        }
      }
    }, 150);

    return () => {
      isMountedRef.current = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {}).then(() => {
              try { scannerRef.current.clear(); } catch(e) {}
            });
          } else {
            scannerRef.current.clear();
          }
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // Đổi camera trước / sau
  const handleSwitchCamera = async () => {
    if (cameras.length < 2) {
      // Thử toggle environment / user
      const nextMode = currentCameraIndex === 0 ? 'user' : 'environment';
      setCurrentCameraIndex(prev => (prev === 0 ? 1 : 0));
      await startCamera({ facingMode: nextMode });
      return;
    }
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    setCurrentCameraIndex(nextIndex);
    await startCamera(cameras[nextIndex].id);
  };

  // Quét từ file ảnh hoặc chụp ảnh camera
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingFile(true);
    setFileError(null);
    try {
      // Nếu chưa có scanner instance thì tạo tạm
      let scanner = scannerRef.current;
      if (!scanner) {
        scanner = new Html5Qrcode(containerId, { formatsToSupport: SUPPORTED_FORMATS, verbose: false });
        scannerRef.current = scanner;
      }
      
      const decodedText = await scanner.scanFile(file, false);
      handleScanSuccess(decodedText);
    } catch (err) {
      console.warn('Lỗi đọc ảnh mã vạch:', err);
      setFileError('Không tìm thấy mã vạch hoặc mã QR trong bức ảnh. Hãy chụp rõ nét, đủ ánh sáng và thử lại.');
    } finally {
      setProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Nhập mã thủ công
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScanSuccess(manualCode.trim());
    setManualCode('');
  };

  // Sử dụng createPortal để gắn trực tiếp vào document.body,
  // hoàn toàn thoát khỏi containment của header (backdrop-blur, transform, v.v.)
  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in select-none">
      <div 
        className="bg-white dark:bg-[#151f33] rounded-3xl overflow-hidden w-full max-w-md shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-500 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">Camera · Ảnh chụp · Nhập mã</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="p-2 text-slate-500 hover:text-sky-500 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-full transition-colors"
                title="Đổi camera"
              >
                <SwitchCamera size={18} />
              </button>
            )}
            <button 
              type="button"
              onClick={onClose} 
              className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-colors"
              title="Đóng (Esc)"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Cảnh báo nếu trên điện thoại dùng HTTP (mạng LAN) */}
        {!isSecure && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/60 dark:border-amber-900/60 px-4 py-2 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <ShieldAlert size={15} className="shrink-0 text-amber-600" />
            <span>
              Mạng LAN HTTP: Trình duyệt hạn chế mở camera trực tiếp. Dùng nút <b>Chụp ảnh</b> bên dưới để quét cực nhanh!
            </span>
          </div>
        )}

        {/* Scanner Viewport / Camera Display */}
        <div className="relative bg-black w-full min-h-[260px] sm:min-h-[290px] flex items-center justify-center overflow-hidden">
          {/* Container cho html5-qrcode */}
          <div id={containerId} className="w-full h-full min-h-[260px]"></div>

          {/* Tia laser quét hiệu ứng động khi đang hoạt động */}
          {isScanning && !cameraError && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              {/* Khung ngắm */}
              <div className="w-64 h-40 border-2 border-sky-400/70 rounded-2xl relative shadow-lg shadow-sky-400/20">
                {/* 4 góc nhấn mạnh */}
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-sky-400 rounded-tl"></span>
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-sky-400 rounded-tr"></span>
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-sky-400 rounded-bl"></span>
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-sky-400 rounded-br"></span>
                {/* Tia laser đỏ/xanh chạy lên xuống */}
                <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-sm shadow-red-500 animate-bounce duration-1000 top-1/2 -translate-y-1/2"></div>
              </div>
              <span className="text-[11px] font-semibold text-white/80 bg-black/50 px-3 py-1 rounded-full mt-3 backdrop-blur-xs">
                Căn chỉnh mã vạch vào giữa khung
              </span>
            </div>
          )}

          {/* Đang khởi động camera */}
          {isStarting && (
            <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-white/90 gap-2">
              <RefreshCw size={28} className="animate-spin text-sky-400" />
              <p className="text-xs font-medium">Đang khởi động Camera...</p>
            </div>
          )}

          {/* Thông báo quét thành công ngay trên màn hình */}
          {lastScanned && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center animate-pop-in z-20">
              <CheckCircle2 size={44} className="text-emerald-400 mb-2 animate-bounce" />
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Quét thành công!</p>
              <p className="text-lg font-mono font-extrabold mt-1 text-white break-all max-w-xs px-3 py-1 bg-black/40 rounded-xl">
                {lastScanned}
              </p>
            </div>
          )}

          {/* Báo lỗi Camera (nếu không có camera hoặc không cấp quyền) */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center text-white p-6 text-center z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <AlertCircle size={26} />
              </div>
              <h4 className="font-bold text-sm mb-1.5 text-slate-100">Camera chưa sẵn sàng</h4>
              <p className="text-xs text-slate-300 leading-relaxed max-w-xs mb-4">
                {cameraError}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="btn-secondary text-xs py-2 px-3.5 rounded-full flex items-center gap-1.5"
                >
                  <RefreshCw size={14} /> Thử lại
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary text-xs py-2 px-4 rounded-full flex items-center gap-1.5"
                >
                  <Upload size={14} /> Chọn / Chụp ảnh
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lỗi đọc file ảnh nếu có */}
        {fileError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-300 text-xs flex items-center justify-between">
            <span>{fileError}</span>
            <button onClick={() => setFileError(null)} className="font-bold ml-2">✕</button>
          </div>
        )}

        {/* Footer Actions: File Upload & Manual SKU Input */}
        <div className="p-4 bg-slate-50 dark:bg-[#0e1726] border-t border-slate-100 dark:border-slate-800 space-y-3 shrink-0">
          {/* Nút chụp ảnh / chọn file từ máy */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            type="button"
            disabled={processingFile}
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-700 hover:border-sky-400 dark:hover:border-sky-500 text-slate-700 dark:text-slate-200 rounded-2xl text-xs sm:text-sm font-bold shadow-xs hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all"
          >
            {processingFile ? (
              <>
                <RefreshCw size={16} className="animate-spin text-sky-500" />
                <span>Đang phân tích hình ảnh...</span>
              </>
            ) : (
              <>
                <Upload size={16} className="text-sky-500" />
                <span>📸 Chụp ảnh hoặc Chọn ảnh mã vạch</span>
              </>
            )}
          </button>

          {/* Form nhập mã vạch thủ công */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Keyboard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                type="text"
                placeholder="Nhập mã vạch / SKU thủ công..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-700 rounded-full focus:outline-hidden focus:ring-2 focus:ring-sky-400/50 text-slate-800 dark:text-slate-100"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="btn-primary py-2 px-4 rounded-full text-xs sm:text-sm shrink-0 disabled:opacity-40"
            >
              Xác nhận
            </button>
          </form>

          <p className="text-[11px] text-center text-slate-400 dark:text-slate-500">
            Hỗ trợ mã vạch EAN-13, EAN-8, Code 128, Code 39, UPC và mã QR
          </p>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default CameraScanner;
