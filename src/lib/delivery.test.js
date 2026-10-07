import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateDelivery, isValidPin } from './delivery.js';

const day = (date) => date.toISOString().slice(0, 10);

test('PIN codes are 6 digits and never start with 0', () => {
  assert.equal(isValidPin('600017'), true);
  assert.equal(isValidPin('060017'), false);
  assert.equal(isValidPin('60001'), false);
  assert.equal(estimateDelivery('abc'), null);
});

test('metro PINs arrive sooner; Sundays are skipped', () => {
  // Friday 26 Sep 2026, noon.
  const from = new Date(2026, 8, 26, 12);
  const chennai = estimateDelivery('600017', { dispatchDays: '1–2', from });
  assert.equal(chennai.metro, true);
  // earliest: 1 + 2 business days → Sat 27, (Sun skipped) Mon 29, Tue 30
  assert.equal(day(chennai.earliest), day(new Date(2026, 8, 30, 12)));
  // latest: 2 + 4 = 6 business days → Sat 27, Mon 29, Tue 30, Wed 1, Thu 2, Fri 3
  assert.equal(day(chennai.latest), day(new Date(2026, 9, 3, 12)));
  const village = estimateDelivery('625706', { dispatchDays: '1–2', from });
  assert.equal(village.metro, false);
  assert.ok(village.latest > chennai.latest);
});
