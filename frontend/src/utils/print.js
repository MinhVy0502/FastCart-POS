import JsBarcode from 'jsbarcode';
import { formatCurrency, formatDate, PAYMENT_LABELS } from './format';
import { vietQrUrl } from '../constants/banks';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** In một đoạn HTML qua iframe ẩn (không mở tab mới, chạy được trên điện thoại). */
export const printHtml = (html) => {
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  const doPrint = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => iframe.remove(), 1000);
  };

  const imgs = Array.from(doc.images);
  if (imgs.length === 0) return setTimeout(doPrint, 150);
  let pending = imgs.length;
  const done = () => { if (--pending <= 0) setTimeout(doPrint, 100); };
  imgs.forEach((img) => (img.complete ? done() : (img.onload = img.onerror = done)));
  setTimeout(() => pending > 0 && doPrint(), 4000); // dự phòng nếu ảnh tải chậm
};

const PAPER = {
  '58mm': { page: '58mm auto', width: '54mm', font: '11px' },
  '80mm': { page: '80mm auto', width: '74mm', font: '12px' },
  A4: { page: 'A4', width: '180mm', font: '13px' }
};

/** HTML hóa đơn bán hàng theo khổ giấy cài đặt. */
export const buildReceiptHtml = (sale, settings = {}) => {
  const paper = PAPER[settings.paperSize] || PAPER['80mm'];
  const items = sale.items || [];
  const qr = sale.paymentMethod === 'TRANSFER' ? vietQrUrl(settings, sale.finalAmount, sale.code) : null;
  const change = Math.max(Number(sale.customerPaid || 0) - Number(sale.finalAmount || 0), 0);

  const rows = items.map((it, i) => `
    <tr><td colspan="3" class="name">${i + 1}. ${esc(it.product?.name || it.name)}</td></tr>
    <tr class="sub">
      <td>${it.quantity} x ${formatCurrency(it.price)}</td>
      <td></td>
      <td class="r">${formatCurrency(it.quantity * it.price)}</td>
    </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.code)}</title>
  <style>
    @page { size: ${paper.page}; margin: 3mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; font-size: ${paper.font}; color: #000; }
    .wrap { width: ${paper.width}; margin: 0 auto; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
    h1 { font-size: 1.35em; margin: 0 0 2px; text-transform: uppercase; }
    .muted { font-size: .9em; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    .name { padding-top: 4px; }
    .sub td { font-size: .95em; }
    .total td { font-size: 1.2em; font-weight: bold; padding-top: 4px; }
    .qr { width: 60%; max-width: 200px; margin: 6px auto 0; display: block; }
    .cancel { border: 2px solid #000; padding: 2px; font-weight: bold; margin: 4px 0; }
  </style></head><body><div class="wrap">
    <div class="c">
      <h1>${esc(settings.storeName || 'Cửa hàng')}</h1>
      ${settings.address ? `<div class="muted">${esc(settings.address)}</div>` : ''}
      ${settings.phone ? `<div class="muted">ĐT: ${esc(settings.phone)}</div>` : ''}
    </div>
    <hr>
    <div class="c b" style="font-size:1.15em">HÓA ĐƠN BÁN HÀNG</div>
    ${sale.status === 'CANCELLED' ? '<div class="c cancel">ĐÃ HỦY</div>' : ''}
    <table class="muted">
      <tr><td>Số HĐ:</td><td class="r b">${esc(sale.code)}</td></tr>
      <tr><td>Ngày:</td><td class="r">${formatDate(sale.createdAt || new Date())}</td></tr>
      <tr><td>Khách hàng:</td><td class="r">${esc(sale.customer?.name || 'Khách lẻ')}</td></tr>
      ${sale.customer?.phone ? `<tr><td>SĐT:</td><td class="r">${esc(sale.customer.phone)}</td></tr>` : ''}
      ${sale.user?.name ? `<tr><td>Thu ngân:</td><td class="r">${esc(sale.user.name)}</td></tr>` : ''}
    </table>
    <hr>
    <table>${rows}</table>
    <hr>
    <table>
      <tr><td>Tổng tiền hàng</td><td class="r">${formatCurrency(sale.totalAmount)}</td></tr>
      ${Number(sale.discount) > 0 ? `<tr><td>Giảm giá</td><td class="r">-${formatCurrency(sale.discount)}</td></tr>` : ''}
      <tr class="total"><td>THANH TOÁN</td><td class="r">${formatCurrency(sale.finalAmount)}</td></tr>
      <tr><td>Hình thức</td><td class="r">${PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}</td></tr>
      ${sale.paymentMethod === 'CASH' && Number(sale.customerPaid) > 0 ? `
        <tr><td>Khách đưa</td><td class="r">${formatCurrency(sale.customerPaid)}</td></tr>
        <tr><td>Tiền thừa</td><td class="r">${formatCurrency(change)}</td></tr>` : ''}
    </table>
    ${qr ? `<img class="qr" src="${qr}" alt="QR"><div class="c muted">Quét mã để chuyển khoản</div>` : ''}
    ${sale.note ? `<hr><div class="muted">Ghi chú: ${esc(sale.note)}</div>` : ''}
    <hr>
    <div class="c muted">${esc(settings.receiptFooter || 'Cảm ơn quý khách và hẹn gặp lại!')}</div>
  </div></body></html>`;
};

export const printReceipt = (sale, settings) => printHtml(buildReceiptHtml(sale, settings));

/** Tạo SVG mã vạch (CODE128) dạng chuỗi. */
const barcodeSvg = (value) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svg, value, { format: 'CODE128', width: 1.6, height: 38, fontSize: 12, margin: 0, displayValue: true });
  } catch {
    return `<div style="font-size:10px">${esc(value)}</div>`;
  }
  return svg.outerHTML;
};

/**
 * In tem mã vạch.
 * labels: [{ product, copies }]
 * layout: 'a4' (lưới 3 cột, khổ A4) | 'roll' (tem cuộn 50x30mm)
 */
export const printBarcodeLabels = (labels, { layout = 'a4', showPrice = true, storeName = '' } = {}) => {
  const cells = labels.flatMap(({ product, copies }) =>
    Array.from({ length: Math.max(copies, 0) }).map(() => `
      <div class="label">
        ${storeName ? `<div class="store">${esc(storeName)}</div>` : ''}
        <div class="name">${esc(product.name)}</div>
        ${barcodeSvg(product.sku)}
        ${showPrice ? `<div class="price">${formatCurrency(product.salePrice)}</div>` : ''}
      </div>`)
  ).join('');

  const css = layout === 'roll'
    ? `@page { size: 50mm 30mm; margin: 0; }
       .grid { display: block; }
       .label { width: 50mm; height: 30mm; padding: 1.5mm; page-break-after: always; }`
    : `@page { size: A4; margin: 8mm; }
       .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
       .label { height: 34mm; border: 1px dashed #bbb; padding: 2mm; }`;

  printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Tem mã vạch</title><style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; color: #000; }
    ${css}
    .label { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; break-inside: avoid; }
    .label svg { max-width: 100%; height: auto; }
    .store { font-size: 8px; text-transform: uppercase; }
    .name { font-size: 10px; font-weight: bold; line-height: 1.15; max-height: 2.3em; overflow: hidden; margin-bottom: 1mm; }
    .price { font-size: 12px; font-weight: bold; margin-top: .5mm; }
  </style></head><body><div class="grid">${cells}</div></body></html>`);
};
