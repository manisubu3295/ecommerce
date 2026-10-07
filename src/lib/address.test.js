import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAddress, normalizePhone, phoneCandidates, stateCode, validateAddress } from './address.js';

const good = { name: 'Priya Kumar', phone: '+91 98765 43210', line1: '14, 2nd Cross Street', line2: 'T. Nagar', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600 017', country: 'IN' };

test('a complete Indian address is accepted and normalized', () => {
  const { address, errors } = validateAddress(good);
  assert.deepEqual(errors, {});
  assert.equal(address.phone, '9876543210');
  assert.equal(address.postalCode, '600017');
  assert.equal(formatAddress(address), '14, 2nd Cross Street\nT. Nagar\nChennai, Tamil Nadu 600017\nIndia');
});

test('bad PIN code, phone and state are each reported', () => {
  const { errors } = validateAddress({ ...good, postalCode: '060001', phone: '12345', state: 'Madras' });
  assert.ok(errors.postalCode);
  assert.ok(errors.phone);
  assert.ok(errors.state);
});

test('missing fields and unsupported countries are rejected', () => {
  const { errors } = validateAddress({ country: 'US' });
  assert.ok(errors.country && errors.name && errors.line1 && errors.city);
  assert.deepEqual(validateAddress({ ...good }, ['SG', 'MY']).errors.country, 'Choose a country we ship to.');
});

test('Singapore needs no state and uses 6-digit postal codes', () => {
  const { address, errors } = validateAddress({ ...good, country: 'SG', state: 'Anything', phone: '+65 9123 4567', postalCode: '238801' });
  assert.deepEqual(errors, {});
  assert.equal(address.state, '');
  assert.equal(address.phone, '91234567');
});

test('phone normalization and lookup candidates', () => {
  assert.equal(normalizePhone('09876543210'), '9876543210');
  assert.equal(normalizePhone('919876543210'), '9876543210');
  assert.ok(phoneCandidates('+91 98765 43210').includes('9876543210'));
});

test('GST state codes', () => {
  assert.equal(stateCode('Tamil Nadu'), '33');
  assert.equal(stateCode('Karnataka'), '29');
  assert.equal(stateCode('Nowhere'), null);
});

test('business settings are cleaned and checked', async () => {
  const { validateBusinessSettings, missingBusinessDetails } = await import('./address.js');
  const good = validateBusinessSettings({ legalName: " Barani's Couture ", gstin: '33abcde1234f1z5', state: 'Tamil Nadu', email: 'Hello@Shop.in', phone: '+91 98765 43210', invoicePrefix: 'sb 26' });
  assert.deepEqual(good.errors, {});
  assert.equal(good.business.gstin, '33ABCDE1234F1Z5');
  assert.equal(good.business.email, 'hello@shop.in');
  assert.equal(good.business.invoicePrefix, 'SB26');
  const bad = validateBusinessSettings({ gstin: '33ABCDE1234F1Z5', state: 'Karnataka', email: 'nope', phone: '123', invoicePrefix: '///' });
  assert.match(bad.errors.gstin, /state code 33/);
  assert.ok(bad.errors.email && bad.errors.phone && bad.errors.invoicePrefix);
  assert.ok(validateBusinessSettings({ gstin: 'ABC' }).errors.gstin);
  assert.deepEqual(missingBusinessDetails({ legalName: 'X', state: 'Goa' }), ['address', 'email']);
});
