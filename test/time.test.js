const test = require('node:test');
const assert = require('node:assert/strict');
const { addMinutes, dateRange, overlaps } = require('../src/utils/time');

test('detects overlapping time ranges', () => {
  assert.equal(overlaps('09:00', '11:00', '10:30', '12:00'), true);
  assert.equal(overlaps('09:00', '11:00', '11:00', '12:00'), false);
});

test('adds minutes in HH:mm format', () => {
  assert.equal(addMinutes('09:15', 105), '11:00');
});

test('builds inclusive date range', () => {
  assert.equal(dateRange('2026-05-14', '2026-05-16').length, 3);
});
