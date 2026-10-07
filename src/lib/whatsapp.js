// WhatsApp click-to-chat links (wa.me) — free, no WhatsApp Business API needed.

// Accepts "98765 43210", "+91 98765 43210", "919876543210" → "919876543210".
// Returns '' when the number can't be a valid international number.
// A number written with "+" or "00" in front already has its country code
// ("+65 9123 4567"); a bare 10-digit number is taken as an Indian mobile.
export function normalizeWhatsAppNumber(raw) {
  const text = String(raw || '').trim();
  const international = /^(\+|00)/.test(text);
  let digits = text.replace(/\D/g, '');
  if (international) digits = digits.replace(/^00/, '');
  else {
    digits = digits.replace(/^0+/, '');
    if (digits.length === 10) digits = `91${digits}`;
  }
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
}

export function whatsAppLink(number, text = '') {
  const digits = normalizeWhatsAppNumber(number);
  if (!digits) return '';
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
