import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SERVICES, lineKey, productServices, unitPrice, validateServices } from './services.js';
import { calculateOrderTotals } from './pricing.js';

test('a product offers only the services it lists, in store order', () => {
  const product = { addons: ['drape', 'fall'] };
  assert.deepEqual(productServices(product, {}).map((s) => s.id), ['fall', 'drape']);
  assert.deepEqual(productServices({}, {}), []);
  assert.deepEqual(productServices(product, { services: [{ id: 'fall', name: 'Fall', price: 300 }] }).map((s) => s.price), [300]);
});

test('cart lines differ by size and add-ons, not add-on order', () => {
  assert.equal(lineKey({ id: 1, size: 'M', addonIds: ['drape', 'fall'] }), lineKey({ id: 1, size: 'M', addonIds: ['fall', 'drape'] }));
  assert.notEqual(lineKey({ id: 1, size: 'M', addonIds: ['fall'] }), lineKey({ id: 1, size: 'M', addonIds: [] }));
  assert.notEqual(lineKey({ id: 1, size: 'M' }), lineKey({ id: 1, size: 'L' }));
});

test('add-ons are part of the unit price and the order total', () => {
  const item = { price: 3450, qty: 2, addonDetails: [DEFAULT_SERVICES[0], DEFAULT_SERVICES[1]] };
  assert.equal(unitPrice(item), 3450 + 250 + 950);
  assert.equal(calculateOrderTotals({ items: [{ price: 3450, addonsTotal: 1200, qty: 2 }] }).subtotal, 9300);
});

test('service settings are checked', () => {
  assert.deepEqual(validateServices([{ id: 'Fall ', name: 'Fall and pico', price: '250' }]).services[0], { id: 'fall', name: 'Fall and pico', detail: '', price: 250 });
  assert.ok(validateServices([{ id: 'x', name: 'X', price: -5 }]).errors['services.0']);
  assert.ok(validateServices([{ id: 'x', name: 'X', price: 1 }, { id: 'x', name: 'Y', price: 1 }]).errors.services);
});
