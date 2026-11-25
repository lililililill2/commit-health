import assert from 'node:assert/strict';
import test from 'node:test';

import {
  sleepTimeOptions,
  sleepDuration,
  formatSleepDuration,
  formatSleepTime,
  shiftSleepTime,
} from './sleep-time.ts';

test('15-minute adjustments wrap midnight and preserve empty values', () => {
  assert.equal(shiftSleepTime('23:45', 15), '00:00');
  assert.equal(shiftSleepTime('00:00', -15), '23:45');
  assert.equal(shiftSleepTime('', 15), '');
  assert.equal(shiftSleepTime('07:00', 1), '07:00');
});

test('time choices cover the day in 96 unique 15-minute intervals', () => {
  assert.equal(sleepTimeOptions.length, 96);
  assert.equal(new Set(sleepTimeOptions).size, 96);
  assert.equal(sleepTimeOptions[0], '00:00');
  assert.equal(sleepTimeOptions.at(-1), '23:45');
});

test('duration updates for same-day and overnight sleep', () => {
  assert.equal(sleepDuration('23:00', '07:15'), 495);
  assert.equal(sleepDuration('01:00', '06:30'), 330);
  assert.equal(sleepDuration('00:00', '00:15'), 15);
  assert.equal(sleepDuration('07:15', '07:00'), 1425);
});

test('empty, equal and non-quarter-hour times cannot be confirmed', () => {
  for (const [start, end] of [
    ['', '07:00'],
    ['23:00', ''],
    ['07:00', '07:00'],
    ['23:01', '07:00'],
    ['24:00', '07:00'],
  ])
    assert.equal(sleepDuration(start, end), null);
});

test('saved times display in Korean time regardless of browser time zone', () => {
  assert.equal(formatSleepTime('2026-11-09T14:00:00.000Z'), '23:00');
  assert.equal(formatSleepTime('2026-11-09T22:15:00.000Z'), '07:15');
  assert.equal(formatSleepDuration(495), '8시간 15분');
  assert.equal(formatSleepDuration(480), '8시간');
  assert.equal(formatSleepDuration(15), '15분');
});
