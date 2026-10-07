import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeWhatsAppNumber, whatsAppLink } from './whatsapp.js';

test('Indian numbers get the 91 country code; bad numbers are rejected', () => {
  assert.equal(normalizeWhatsAppNumber('98765 43210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('+91 98765-43210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('09876543210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('+65 9123 4567'), '6591234567');
  assert.equal(normalizeWhatsAppNumber('12345'), '');
  assert.equal(normalizeWhatsAppNumber(''), '');
});

test('links are wa.me with an encoded message, or empty when no number', () => {
  assert.equal(whatsAppLink('9876543210', 'Hi & hello'), 'https://wa.me/919876543210?text=Hi%20%26%20hello');
  assert.equal(whatsAppLink('', 'Hi'), '');
});
