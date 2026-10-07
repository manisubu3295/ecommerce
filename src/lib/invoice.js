// Invoice helpers shared by the server (which issues invoices and serves the
// printable page) and its tests. Pure functions only — no DOM, no database.

// Indian financial year (1 April – 31 March) of a moment, in IST, e.g. "2026-27".
export function financialYear(date = new Date()) {
  const ist = new Date(new Date(date).getTime() + 330 * 60 * 1000);
  const startYear = ist.getUTCMonth() >= 3 ? ist.getUTCFullYear() : ist.getUTCFullYear() - 1;
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function formatInvoiceNumber(prefix, fy, sequence) {
  return `${prefix}/${fy}/${String(sequence).padStart(5, '0')}`;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ''}`;
}

function belowThousand(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

// Indian numbering (lakh, crore), as printed on Indian invoices:
// 1234567.5 → "Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise Only"
export function amountInWords(amount) {
  const paiseTotal = Math.round(Math.abs(Number(amount) || 0) * 100);
  let rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;
  const parts = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${belowThousand(crore)} Crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (rupees) parts.push(belowThousand(rupees));
  const rupeeWords = parts.length ? parts.join(' ') : 'Zero';
  return `Rupees ${rupeeWords}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`;
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(value) || 0);
const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

// Page styles shared by invoices and credit notes.
const DOC_STYLES = `
  :root { --ink: #1D1F24; --muted: #5B6166; --line: #D7DCD8; --accent: #0F4F54; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #E9ECEA; color: var(--ink); font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  .page { max-width: 820px; margin: 24px auto; background: #fff; padding: 40px 44px; border: 1px solid var(--line); border-radius: 12px; }
  .bar { max-width: 820px; margin: 24px auto 0; display: flex; justify-content: flex-end; }
  .bar button { font: inherit; font-weight: 600; color: #fff; background: var(--accent); border: 0; border-radius: 8px; padding: 10px 18px; cursor: pointer; }
  header { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 3px solid var(--accent); }
  h1 { margin: 0 0 6px; font-size: 24px; }
  h2 { margin: 0; font-size: 22px; text-align: right; color: var(--accent); }
  .muted { color: var(--muted); font-size: 13px; }
  .meta { text-align: right; margin-top: 6px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
  .label { font-size: 12px; color: var(--muted); margin-bottom: 4px; }
  .address { white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  .items th { text-align: left; font-size: 12px; color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--line); padding: 8px 6px; }
  .items td { border-bottom: 1px solid #EEF0EE; padding: 10px 6px; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .totals { width: 320px; margin: 16px 0 0 auto; }
  .totals td { padding: 5px 6px; }
  .totals .grand td { border-top: 2px solid var(--ink); font-weight: 700; font-size: 16px; padding-top: 10px; }
  .words { margin-top: 16px; padding: 12px 14px; background: #F4F6F4; border-radius: 8px; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--line); }
  @media (max-width: 600px) { .page { padding: 24px 18px; margin: 0; border-radius: 0; } header, .parties { display: block; } h2, .meta { text-align: left; margin-top: 16px; } .totals { width: 100%; } }
  @media print { body { background: #fff; } .bar { display: none; } .page { margin: 0; border: 0; padding: 0; max-width: none; } }
`;

// A self-contained, print-ready invoice page. Every value is escaped: buyer
// names and addresses come from the checkout form.
export function renderInvoiceHtml(invoice) {
  const seller = invoice.seller || {};
  const buyer = invoice.buyer || {};
  const isTaxInvoice = Boolean(seller.gstin);
  const rows = (invoice.items || []).map((item, index) => `<tr>
      <td>${index + 1}</td>
      <td><strong>${escapeHtml(item.name)}</strong>${item.size ? `<br><span class="muted">Size ${escapeHtml(item.size)}</span>` : ''}${item.sku ? `<br><span class="muted">SKU ${escapeHtml(item.sku)}</span>` : ''}${item.hsn ? `<br><span class="muted">HSN ${escapeHtml(item.hsn)}</span>` : ''}</td>
      <td class="num">${escapeHtml(item.qty)}</td>
      <td class="num">${money(item.unitPrice)}</td>
      <td class="num">${money(item.total)}</td>
    </tr>`).join('');
  const summary = [
    ['Subtotal', money(invoice.subtotal)],
    invoice.discount ? [`Discount${invoice.couponCode ? ` (${escapeHtml(invoice.couponCode)})` : ''}`, `−${money(invoice.discount)}`] : null,
    ['Shipping', Number(invoice.shipping) ? money(invoice.shipping) : 'Free'],
    // CGST + SGST or IGST when the seller's state is known; otherwise one GST line.
    ...(invoice.taxLines?.length
      ? invoice.taxLines.map((line) => [escapeHtml(line.label), money(line.amount)])
      : [Number(invoice.tax) ? [`GST${invoice.taxRatePercent != null ? ` @ ${escapeHtml(invoice.taxRatePercent)}%` : ''}`, money(invoice.tax)] : null]),
  ].filter(Boolean).map(([label, value]) => `<tr><td>${label}</td><td class="num">${value}</td></tr>`).join('');
  const payment = invoice.payment || {};
  const paidBy = payment.method === 'razorpay' ? `Razorpay${payment.paymentId ? ` (${escapeHtml(payment.paymentId)})` : ''}` : payment.method === 'demo' ? 'Demo checkout (not charged)' : escapeHtml(payment.method || 'Online');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(invoice.number)} — ${escapeHtml(seller.legalName)}</title>
<style>
${DOC_STYLES}
</style>
</head>
<body>
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<main class="page">
  <header>
    <div>
      <h1>${escapeHtml(seller.legalName)}</h1>
      ${seller.address ? `<div class="address muted">${escapeHtml(seller.address)}</div>` : ''}
      ${seller.gstin ? `<div class="muted">GSTIN: ${escapeHtml(seller.gstin)}</div>` : ''}
      ${seller.state ? `<div class="muted">State: ${escapeHtml(seller.state)}</div>` : ''}
      <div class="muted">${[seller.email, seller.phone].filter(Boolean).map(escapeHtml).join(' &nbsp; ')}</div>
    </div>
    <div>
      <h2>${isTaxInvoice ? 'Tax invoice' : 'Invoice'}</h2>
      <div class="meta">
        <div><strong>${escapeHtml(invoice.number)}</strong></div>
        <div class="muted">Invoice date: ${day(invoice.issuedAt)}</div>
        <div class="muted">Order: ${escapeHtml(invoice.orderId)}, ${day(invoice.orderDate)}</div>
        ${invoice.placeOfSupply ? `<div class="muted">Place of supply: ${escapeHtml(invoice.placeOfSupply)}</div>` : ''}
      </div>
    </div>
  </header>
  <section class="parties">
    <div>
      <div class="label">Billed and shipped to</div>
      <strong>${escapeHtml(buyer.name)}</strong>
      ${buyer.address ? `<div class="address">${escapeHtml(buyer.address)}</div>` : ''}
      <div class="muted">${[buyer.phone, buyer.email].filter(Boolean).map(escapeHtml).join(' &nbsp; ')}</div>
    </div>
    <div>
      <div class="label">Payment</div>
      <div>Paid by ${paidBy}</div>
      ${payment.paidAt ? `<div class="muted">on ${day(payment.paidAt)}</div>` : ''}
    </div>
  </section>
  <table class="items">
    <thead><tr><th>#</th><th>Item</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tbody>${summary}<tr class="grand"><td>Total</td><td class="num">${money(invoice.total)}</td></tr></tbody>
  </table>
  <div class="words"><span class="label">Amount in words</span><br>${escapeHtml(amountInWords(invoice.total))}</div>
  <footer class="muted">This is a computer-generated invoice and does not need a signature.</footer>
</main>
</body>
</html>`;
}

// GST reversed on a credit note, in proportion to the refunded share of the
// invoice total. Each tax line is scaled the same way; rounding differences
// land on the last line so the lines always add up to `tax`.
export function creditNoteTax(invoice, amount) {
  const total = Number(invoice.total) || 0;
  const invoiceTax = Number(invoice.tax) || 0;
  if (!total || !invoiceTax) return { tax: 0, taxLines: [] };
  const share = Math.min(1, Number(amount) / total);
  const tax = Math.round(invoiceTax * share * 100) / 100;
  const lines = invoice.taxLines || [];
  let assigned = 0;
  const taxLines = lines.map((line, index) => {
    const value = index === lines.length - 1 ? Math.round((tax - assigned) * 100) / 100 : Math.round(line.amount * share * 100) / 100;
    assigned += value;
    return { label: line.label, amount: value };
  });
  return { tax, taxLines };
}

// Credit note: the legal record of a refund against an issued invoice.
export function renderCreditNoteHtml(note) {
  const seller = note.seller || {};
  const buyer = note.buyer || {};
  const taxRows = (note.taxLines?.length ? note.taxLines : (Number(note.tax) ? [{ label: 'GST', amount: note.tax }] : []))
    .map((line) => `<tr><td>${escapeHtml(line.label)} reversed</td><td class="num">${money(line.amount)}</td></tr>`).join('');
  const method = { razorpay: 'Razorpay', upi: 'UPI', bank: 'Bank transfer', cash: 'Cash', other: 'Other' }[note.refund?.method] || escapeHtml(note.refund?.method || '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(note.number)} — ${escapeHtml(seller.legalName)}</title>
<style>
${DOC_STYLES}
</style>
</head>
<body>
<div class="bar"><button type="button" onclick="window.print()">Print or save as PDF</button></div>
<main class="page">
  <header>
    <div>
      <h1>${escapeHtml(seller.legalName)}</h1>
      ${seller.address ? `<div class="address muted">${escapeHtml(seller.address)}</div>` : ''}
      ${seller.gstin ? `<div class="muted">GSTIN: ${escapeHtml(seller.gstin)}</div>` : ''}
      ${seller.state ? `<div class="muted">State: ${escapeHtml(seller.state)}</div>` : ''}
    </div>
    <div>
      <h2>Credit note</h2>
      <div class="meta">
        <div><strong>${escapeHtml(note.number)}</strong></div>
        <div class="muted">Date: ${day(note.issuedAt)}</div>
        <div class="muted">Against invoice ${escapeHtml(note.invoiceNumber)}, ${day(note.invoiceDate)}</div>
        <div class="muted">Order: ${escapeHtml(note.orderId)}</div>
      </div>
    </div>
  </header>
  <section class="parties">
    <div>
      <div class="label">Issued to</div>
      <strong>${escapeHtml(buyer.name)}</strong>
      ${buyer.address ? `<div class="address">${escapeHtml(buyer.address)}</div>` : ''}
      <div class="muted">${[buyer.phone, buyer.email].filter(Boolean).map(escapeHtml).join(' &nbsp; ')}</div>
    </div>
    <div>
      <div class="label">Refund</div>
      <div>${method}${note.refund?.reference ? ` (${escapeHtml(note.refund.reference)})` : ''}</div>
      ${note.reason ? `<div class="muted">Reason: ${escapeHtml(note.reason)}</div>` : ''}
    </div>
  </section>
  <table class="totals">
    <tbody>
      <tr><td>Value refunded (before GST)</td><td class="num">${money(Number(note.amount) - Number(note.tax || 0))}</td></tr>
      ${taxRows}
      <tr class="grand"><td>Total credited</td><td class="num">${money(note.amount)}</td></tr>
    </tbody>
  </table>
  <div class="words"><span class="label">Amount in words</span><br>${escapeHtml(amountInWords(note.amount))}</div>
  <footer class="muted">This credit note reduces the amount of invoice ${escapeHtml(note.invoiceNumber)}. It is computer-generated and does not need a signature.</footer>
</main>
</body>
</html>`;
}
