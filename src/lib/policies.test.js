import test from 'node:test';
import assert from 'node:assert/strict';
import { policySettings, shippingPromise, validatePolicySettings } from './policies.js';

const inr = (value) => `₹${value}`;

test('defaults keep the currently published 30-day return policy', () => {
  assert.deepEqual(policySettings({}), { returnDays: 30, dispatchDays: '1–2', grievanceName: '' });
  assert.equal(policySettings({ policies: { returnDays: 0 } }).returnDays, 0);
});

test('policy settings are checked and cleaned', () => {
  assert.deepEqual(validatePolicySettings({ returnDays: '7', dispatchDays: ' 2–3 ', grievanceName: ' Priya ' }), { policies: { returnDays: 7, dispatchDays: '2–3', grievanceName: 'Priya' }, errors: {} });
  assert.ok(validatePolicySettings({ returnDays: 120 }).errors.returnDays);
  assert.ok(validatePolicySettings({ returnDays: 2.5 }).errors.returnDays);
  assert.ok(validatePolicySettings({ returnDays: 'abc' }).errors.returnDays);
});

test('shipping promise follows the pricing settings', () => {
  assert.equal(shippingPromise({ shippingFee: 0 }, inr), 'Free shipping');
  assert.equal(shippingPromise({ shippingFee: 99, freeShippingThreshold: 2999 }, inr), 'Free shipping over ₹2999');
  assert.equal(shippingPromise({ shippingFee: 99 }, inr), '₹99 shipping');
});
