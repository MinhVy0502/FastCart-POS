import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X } from 'lucide-react';

const CameraScanner = ({ onScan, onClose }) => {

  useEffect(() => {
    // Config cho máy quét mã vạch/QR
    const config = { 
      fps: 10, 
      qrbox: { width: 250, height: 150 },
      rememberLastUsedCamera: true,
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true, // Hỗ trợ bật đèn flash trên điện thoại
    };

    // Khởi tạo scanner gắn vào element có id "reader"
    const scanner = new Html5QrcodeScanner("reader", config, false);

    scanner.render(
      (decodedText) => {
        // Khi quét thành công
        scanner.pause(true); // Tạm dừng camera một chút
        onScan(decodedText);
        
        // Phát tiếng bíp (tùy chọn)
        try {
          const audio = new Audio('/beep.mp3');
          audio.play().catch(e => console.log(e));
        } catch(e) {}

        setTimeout(() => scanner.resume(), 1500); // Mở lại camera sau 1.5s để có thể quét mã tiếp theo
      },
      (errorMessage) => {
        // Bỏ qua lỗi vì nó sẽ báo liên tục khi khung hình chưa có mã vạch
      }
    );

    // Cleanup khi component bị hủy
    return () => {
      scanner.clear().catch(console.error);
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4 md:p-0 backdrop-blur-sm">
      <div className="bg-white rounded-3xl overflow-hidden w-full max-w-md relative shadow-2xl">
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Quét mã vạch Camera</h3>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Nơi thư viện html5-qrcode sẽ render video camera */}
        <div id="reader" className="w-full bg-black min-h-[300px]"></div>
        
        <div className="p-4 text-center bg-slate-50">
          <p className="text-sm font-medium text-slate-600">
            Đưa mã vạch hoặc mã QR vào khung hình
          </p>
          <p className="text-xs text-slate-400 mt-1">Hỗ trợ quét bằng Camera điện thoại</p>
        </div>
      </div>
    </div>
  );
};

export default CameraScanner;
