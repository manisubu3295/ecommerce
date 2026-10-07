import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateOrderTotals } from './pricing.js';

test('sums subtotal across items and quantities', () => {
  const totals = calculateOrderTotals({ items: [{ price: 245, qty: 2 }, { price: 180, qty: 1 }] });
  assert.equal(totals.subtotal, 670);
  assert.equal(totals.shipping, 0);
  assert.equal(totals.tax, 0);
  assert.equal(totals.total, 670);
});

test('applies a flat shipping fee', () => {
  const totals = calculateOrderTotals({ items: [{ price: 100, qty: 1 }], shippingFee: 15 });
  assert.equal(totals.shipping, 15);
  assert.equal(totals.total, 115);
});

test('waives shipping once the free-shipping threshold is met', () => {
  const below = calculateOrderTotals({ items: [{ price: 100, qty: 1 }], shippingFee: 15, freeShippingThreshold: 200 });
  assert.equal(below.shipping, 15);

  const above = calculateOrderTotals({ items: [{ price: 250, qty: 1 }], shippingFee: 15, freeShippingThreshold: 200 });
  assert.equal(above.shipping, 0);
});

test('applies a percentage tax rate on the subtotal', () => {
  const totals = calculateOrderTotals({ items: [{ price: 100, qty: 1 }], taxRatePercent: 18 });
  assert.equal(totals.tax, 18);
  assert.equal(totals.total, 118);
});

test('combines tax and shipping into the total', () => {
  const totals = calculateOrderTotals({ items: [{ price: 100, qty: 2 }], taxRatePercent: 18, shippingFee: 10 });
  assert.equal(totals.subtotal, 200);
  assert.equal(totals.tax, 36);
  assert.equal(totals.shipping, 10);
  assert.equal(totals.total, 246);
});

test('returns zero totals for an empty cart', () => {
  const totals = calculateOrderTotals({ items: [] });
  assert.equal(totals.subtotal, 0);
  assert.equal(totals.total, 0);
});

test('applies a discount before tax', () => {
  const totals = calculateOrderTotals({ items: [{ price: 200, qty: 1 }], taxRatePercent: 10, discountAmount: 50 });
  assert.equal(totals.subtotal, 200);
  assert.equal(totals.discount, 50);
  assert.equal(totals.tax, 15); // 10% of (200 - 50)
  assert.equal(totals.total, 165);
});

test('never lets a discount exceed the subtotal', () => {
  const totals = calculateOrderTotals({ items: [{ price: 50, qty: 1 }], discountAmount: 500 });
  assert.equal(totals.discount, 50);
  assert.equal(totals.total, 0);
});
