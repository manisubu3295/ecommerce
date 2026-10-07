// Ready-to-wear services a shopper can add to a product (fall & pico, blouse
// stitching, pre-draping). The list and prices live in Store settings; each
// product says which of them it offers. Shared by the product page, cart and
// server so the price shown is always the price charged.

export const DEFAULT_SERVICES = [
  { id: 'fall', name: 'Fall and pico', detail: 'Done for you, so it’s ready to drape', price: 250 },
  { id: 'blouse', name: 'Blouse stitching', detail: 'We’ll WhatsApp you for measurements after you order', price: 950 },
  { id: 'drape', name: 'Pre-draping', detail: 'Pleated and pressed, ready to wear in two minutes', price: 600 },
];

export function serviceList(settings = {}) {
  return Array.isArray(settings.services) && settings.services.length ? settings.services : DEFAULT_SERVICES;
}

// The services this product offers, in the store's order.
export function productServices(product, settings) {
  const offered = new Set(product?.addons || []);
  return serviceList(settings).filter((service) => offered.has(service.id));
}

// Same product + size + add-ons = one cart line; anything different is a new line.
// A product's `addons` is what it OFFERS; a cart line's `addonIds` is what the
// shopper CHOSE (kept separate so saving stock never overwrites the offer list).
export function lineKey(item) {
  return `${item.id}|${item.size ?? ''}|${[...(item.addonIds || [])].sort().join('+')}`;
}

export const addonsTotal = (addonDetails = []) => addonDetails.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0);

// Price of one unit including its add-ons.
export function unitPrice(item) {
  return Number(item.price || 0) + (item.addonsTotal != null ? Number(item.addonsTotal) : addonsTotal(item.addonDetails));
}

// Admin Store settings → Services. Returns cleaned list and field errors.
export function validateServices(input) {
  const list = Array.isArray(input) ? input : [];
  const errors = {};
  const services = list.slice(0, 10).map((service, index) => {
    const id = String(service.id || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
    const price = Number(service.price);
    const cleaned = { id, name: String(service.name || '').trim().slice(0, 60), detail: String(service.detail || '').trim().slice(0, 120), price };
    if (!id || !cleaned.name) errors[`services.${index}`] = 'Each service needs a name.';
    else if (!Number.isFinite(price) || price < 0 || price > 50000) errors[`services.${index}`] = 'Enter a price between ₹0 and ₹50,000.';
    return cleaned;
  });
  const ids = services.map((service) => service.id);
  if (new Set(ids).size !== ids.length) errors.services = 'Two services have the same name.';
  return { services, errors };
}
