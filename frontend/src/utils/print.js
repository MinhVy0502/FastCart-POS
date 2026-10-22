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

/** HTML Phiếu giao hàng kiêm xuất kho khổ A4/A5 (B2B cho đại lý / tiệm tạp hóa). */
export const buildDeliveryNoteHtml = (sale, settings = {}) => {
  const items = sale.items || [];
  const customer = sale.customer || {};
  const currentDebt = Number(customer.currentDebt || 0);
  const unpaidForSale = Math.max(Number(sale.finalAmount || 0) - Number(sale.customerPaid || 0), 0);
  const oldDebt = Math.max(currentDebt - unpaidForSale, 0);

  const rows = items.map((it, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td class="mono">${esc(it.product?.sku || it.sku || '')}</td>
      <td class="b">${esc(it.product?.name || it.name)}</td>
      <td class="c">Cái</td>
      <td class="c b">${it.quantity}</td>
      <td class="r">${formatCurrency(it.price)}</td>
      <td class="r b">${formatCurrency(it.quantity * it.price)}</td>
    </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Phieu_giao_hang_${esc(sale.code)}</title>
  <style>
    @page { size: A5 landscape; margin: 8mm; }
    @media print {
      body { margin: 0; }
    }
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', Times, serif; font-size: 13px; color: #000; line-height: 1.4; padding: 10px; }
    .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
    .mono { font-family: monospace; font-size: 12px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .company { font-size: 14px; }
    .company h2 { margin: 0 0 4px; font-size: 17px; text-transform: uppercase; }
    .doc-title { text-align: center; margin: 10px 0; }
    .doc-title h1 { margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
    .doc-title p { margin: 2px 0 0; font-style: italic; font-size: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 14px; font-size: 13px; }
    table.data { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    table.data th, table.data td { border: 1px solid #333; padding: 5px 7px; }
    table.data th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
    .summary-box { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
    .note-box { flex: 1; border: 1px dashed #666; padding: 8px 12px; border-radius: 4px; }
    .calc-box { width: 330px; }
    .calc-box table { width: 100%; border-collapse: collapse; }
    .calc-box td { padding: 2px 0; }
    .calc-box tr.highlight td { font-weight: bold; font-size: 14px; border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 4px 0; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); text-align: center; margin-top: 25px; page-break-inside: avoid; }
    .sig-title { font-weight: bold; margin-bottom: 2px; }
    .sig-sub { font-size: 11px; font-style: italic; color: #555; }
    .sig-space { height: 60px; }
  </style></head><body>
    <div class="header">
      <div class="company">
        <h2>${esc(settings.storeName || 'CỬA HÀNG ĐẠI LÝ BÁN BUÔN & BÁN LẺ')}</h2>
        <div>Địa chỉ: ${esc(settings.address || 'Chưa cập nhật địa chỉ')}</div>
        <div>Điện thoại: ${esc(settings.phone || '')}</div>
      </div>
      <div style="text-align: right; font-size: 12px;">
        <div class="b">Mã đơn: ${esc(sale.code)}</div>
        <div>Ngày lập: ${formatDate(sale.createdAt || new Date())}</div>
      </div>
    </div>

    <div class="doc-title">
      <h1>PHIẾU GIAO HÀNG KIÊM XUẤT KHO</h1>
      <p>(Khách hàng sỉ / Tiệm tạp hóa đối soát công nợ)</p>
    </div>

    <div class="info-grid">
      <div><b>Khách hàng:</b> ${esc(customer.name || 'Khách lẻ')}</div>
      <div><b>Tên tiệm tạp hóa:</b> ${esc(customer.storeName || customer.name || '-')}</div>
      <div><b>Số điện thoại:</b> ${esc(customer.phone || 'Chưa có')}</div>
      <div><b>Địa chỉ giao hàng:</b> ${esc(customer.address || 'Nhận tại quầy')}</div>
    </div>

    <table class="data">
      <thead>
        <tr>
          <th style="width: 35px">STT</th>
          <th style="width: 100px">Mã SKU</th>
          <th>Tên hàng hóa / Sản phẩm</th>
          <th style="width: 50px">ĐVT</th>
          <th style="width: 55px">SL</th>
          <th style="width: 100px">Đơn giá</th>
          <th style="width: 110px">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="summary-box">
      <div class="note-box">
        <b>Ghi chú giao hàng:</b>
        <p style="margin: 4px 0 0; font-style: italic;">${esc(sale.note || 'Không có ghi chú thêm.')}</p>
      </div>

      <div class="calc-box">
        <table>
          <tr><td>Tổng tiền hàng:</td><td class="r b">${formatCurrency(sale.totalAmount)}</td></tr>
          ${Number(sale.discount) > 0 ? `<tr><td>Chiết khấu giảm giá:</td><td class="r text-red">-${formatCurrency(sale.discount)}</td></tr>` : ''}
          <tr class="highlight"><td>CỘNG TIỀN HÀNG:</td><td class="r">${formatCurrency(sale.finalAmount)}</td></tr>
          <tr><td>Đã thanh toán (${PAYMENT_LABELS[sale.paymentMethod] || sale.paymentMethod}):</td><td class="r b">${formatCurrency(sale.customerPaid)}</td></tr>
          <tr><td>Nợ phát sinh đơn này:</td><td class="r b" style="color: ${unpaidForSale > 0 ? '#b91c1c' : '#000'}">${formatCurrency(unpaidForSale)}</td></tr>
          <tr><td>Dư nợ cũ của tiệm:</td><td class="r">${formatCurrency(oldDebt)}</td></tr>
          <tr style="border-top: 2px solid #000; font-size: 15px; font-weight: bold; color: #b91c1c;">
            <td>TỔNG NỢ HIỆN TẠI:</td><td class="r">${formatCurrency(currentDebt)}</td></tr>
        </table>
      </div>
    </div>

    <div class="signatures">
      <div>
        <div class="sig-title">Người Lập Phiếu</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
        <div>${esc(sale.user?.name || '')}</div>
      </div>
      <div>
        <div class="sig-title">Người Giao Hàng</div>
        <div class="sig-sub">(Ký, họ tên)</div>
        <div class="sig-space"></div>
      </div>
      <div>
        <div class="sig-title">Đại Diện Tiệm / Khách Hàng</div>
        <div class="sig-sub">(Ký, xác nhận nợ)</div>
        <div class="sig-space"></div>
        <div>${esc(customer.name || '')}</div>
      </div>
    </div>
  </body></html>`;
};

export const printDeliveryNote = (sale, settings) => printHtml(buildDeliveryNoteHtml(sale, settings));

