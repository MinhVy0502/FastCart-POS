// Danh sách ngân hàng hỗ trợ VietQR (mã BIN theo NAPAS)
export const BANKS = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970405', name: 'Agribank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970441', name: 'VIB' },
  { bin: '970443', name: 'SHB' },
  { bin: '970437', name: 'HDBank' },
  { bin: '970448', name: 'OCB' },
  { bin: '970426', name: 'MSB' },
  { bin: '970440', name: 'SeABank' },
  { bin: '970431', name: 'Eximbank' },
  { bin: '970449', name: 'LPBank' },
  { bin: '970428', name: 'Nam A Bank' },
  { bin: '970425', name: 'ABBANK' },
  { bin: '970409', name: 'Bac A Bank' },
  { bin: '546034', name: 'CAKE by VPBank' },
  { bin: '963388', name: 'Timo' }
];

export const bankName = (bin) => BANKS.find((b) => b.bin === bin)?.name || '';

/** Ảnh QR chuyển khoản VietQR (quét bằng mọi app ngân hàng). */
export const vietQrUrl = (settings, amount, info) => {
  if (!settings?.bankBin || !settings?.bankAccount) return null;
  const params = new URLSearchParams({
    amount: String(Math.round(Number(amount) || 0)),
    addInfo: info || '',
    accountName: settings.bankAccountName || ''
  });
  return `https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccount}-compact2.png?${params}`;
};
