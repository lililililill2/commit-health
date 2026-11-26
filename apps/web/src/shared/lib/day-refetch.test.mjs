import assert from 'node:assert/strict';
import test from 'node:test';

import { refetchUntilDayEnds } from './day-refetch.ts';

const dayEndsAt = '2026-11-11T15:00:00.000Z';
const at = (iso) => Date.parse(iso);

test('does not poll before the day is known', () => {
  assert.equal(refetchUntilDayEnds(undefined), false);
});

test('polls at the cap during the day and right after midnight near the end', () => {
  assert.equal(refetchUntilDayEnds(dayEndsAt, 60_000, at('2026-11-11T03:00:00Z')), 60_000);
  assert.equal(refetchUntilDayEnds(dayEndsAt, 4_000, at('2026-11-11T03:00:00Z')), 4_000);
  assert.equal(refetchUntilDayEnds(dayEndsAt, 60_000, at('2026-11-11T14:59:50Z')), 10_100);
});

test('retries every second once the day has already ended', () => {
  assert.equal(refetchUntilDayEnds(dayEndsAt, 60_000, at('2026-11-11T15:00:05Z')), 1_000);
});
