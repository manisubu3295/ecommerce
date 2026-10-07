import test from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords, financialYear, formatInvoiceNumber, renderInvoiceHtml } from './invoice.js';

test('financial year runs April to March, in IST', () => {
  assert.equal(financialYear('2026-09-24T10:00:00Z'), '2026-27');
  assert.equal(financialYear('2027-03-31T10:00:00Z'), '2026-27');
  // 31 March 19:00 UTC is already 1 April 00:30 in India.
  assert.equal(financialYear('2027-03-31T19:00:00Z'), '2027-28');
  assert.equal(financialYear('2099-06-01T00:00:00Z'), '2099-00');
});

test('invoice numbers are zero-padded and sequential', () => {
  assert.equal(formatInvoiceNumber('SB', '2026-27', 7), 'SB/2026-27/00007');
  assert.equal(formatInvoiceNumber('SB', '2026-27', 123456), 'SB/2026-27/123456');
});

test('amount in words uses Indian numbering', () => {
  assert.equal(amountInWords(356.25), 'Rupees Three Hundred Fifty-Six and Twenty-Five Paise Only');
  assert.equal(amountInWords(1234567.5), 'Rupees Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven and Fifty Paise Only');
  assert.equal(amountInWords(20000000), 'Rupees Two Crore Only');
  assert.equal(amountInWords(0), 'Rupees Zero Only');
});

test('invoice page escapes customer-entered text', () => {
  const html = renderInvoiceHtml({
    number: 'SB/2026-27/00001', issuedAt: '2026-09-24T10:00:00Z', orderId: 'ARC-1', orderDate: '2026-09-24T09:00:00Z',
    seller: { legalName: "Barani's Couture", gstin: '33ABCDE1234F1Z5' },
    buyer: { name: '<script>alert(1)</script>', address: 'Chennai' },
    items: [{ name: 'Saree', qty: 1, unitPrice: 320, total: 320 }],
    subtotal: 320, shipping: 0, tax: 0, total: 320, payment: { method: 'razorpay', paymentId: 'pay_1' },
  });
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('Tax invoice'));
});

test('credit note reverses GST in proportion, lines add up', async () => {
  const { creditNoteTax } = await import('./invoice.js');
  const invoice = { total: 1050, tax: 50, taxLines: [{ label: 'CGST @ 2.5%', amount: 25 }, { label: 'SGST @ 2.5%', amount: 25 }] };
  assert.deepEqual(creditNoteTax(invoice, 1050), { tax: 50, taxLines: [{ label: 'CGST @ 2.5%', amount: 25 }, { label: 'SGST @ 2.5%', amount: 25 }] });
  const partial = creditNoteTax(invoice, 333);
  assert.equal(partial.tax, 15.86);
  assert.equal(Math.round(partial.taxLines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100, 15.86);
  assert.deepEqual(creditNoteTax({ total: 500, tax: 0 }, 100), { tax: 0, taxLines: [] });
});
