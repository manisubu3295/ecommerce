// "Arrives by…" estimate for an Indian PIN code, from the store's dispatch
// time plus typical courier transit. An estimate, worded as one — the same
// ranges the Shipping Policy states.

// First three digits of metro-city PIN codes (Chennai, Bengaluru, Mumbai,
// Delhi, Hyderabad, Kolkata, Pune, Ahmedabad, Coimbatore).
const METRO_PREFIXES = new Set(['600', '560', '400', '110', '500', '700', '411', '380', '641']);

export const isValidPin = (pin) => /^[1-9]\d{5}$/.test(String(pin || '').trim());

// "1–2" → 2 (the slower end, so the promise is kept).
function maxDays(range, fallback) {
  const numbers = String(range || '').match(/\d+/g);
  return numbers ? Math.max(...numbers.map(Number)) : fallback;
}

// Adds business days, skipping Sundays (couriers don't deliver on Sunday).
function addBusinessDays(from, days) {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    if (date.getDay() !== 0) added += 1;
  }
  return date;
}

export function estimateDelivery(pin, { dispatchDays = '1–2', from = new Date() } = {}) {
  if (!isValidPin(pin)) return null;
  const metro = METRO_PREFIXES.has(String(pin).trim().slice(0, 3));
  const dispatch = maxDays(dispatchDays, 2);
  const [minTransit, maxTransit] = metro ? [2, 4] : [3, 6];
  return {
    metro,
    earliest: addBusinessDays(from, 1 + minTransit),
    latest: addBusinessDays(from, dispatch + maxTransit),
  };
}

export function formatDeliveryRange({ earliest, latest }) {
  const format = (date) => date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return earliest.toDateString() === latest.toDateString() ? format(latest) : `${format(earliest)} – ${format(latest)}`;
}
