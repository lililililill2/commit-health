import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canSaveSlot,
  dayInput,
  draftSlot,
  hasMeal,
  mainMealKinds,
  readDayDraft,
  writeDayDraft,
} from './meal-draft.ts';

test('skipped is explicit and unfinished manual input cannot be saved', () => {
  const empty = draftSlot();
  const slots = {
    BREAKFAST: { ...empty, skipped: true },
    LUNCH: {
      ...empty,
      items: [
        {
          key: 'x',
          name: '김밥',
          source: 'MANUAL',
          input: { name: '김밥' },
          portions: 1,
          kcal: '',
        },
      ],
    },
    DINNER: { ...empty, skipped: true },
    SNACK: empty,
  };
  assert.equal(mainMealKinds.filter((kind) => hasMeal(slots[kind])).length, 3);
  assert.equal(canSaveSlot({ ...empty, manualName: '간식' }), false);
  const request = dayInput('2026-11-25', { requestId: 'stable-retry-id', slots }, slots);
  assert.equal(request.meals.length, 3);
  assert.equal(request.meals[0].skipped, true);
  assert.equal(request.meals[1].items[0].name, '김밥');
  assert.equal(request.requestId, 'stable-retry-id');
});

test('a browser draft survives reopening and carries no state into another date key', (context) => {
  const data = new Map();
  globalThis.window = {
    localStorage: {
      setItem: (key, value) => data.set(key, value),
      getItem: (key) => data.get(key) ?? null,
      removeItem: (key) => data.delete(key),
    },
  };
  context.after(() => {
    delete globalThis.window;
  });
  const draft = {
    requestId: 'same-on-retry',
    slots: { BREAKFAST: { ...draftSlot(), manualName: '계란' } },
  };
  assert.equal(writeDayDraft('user:today', draft), true);
  assert.deepEqual(readDayDraft('user:today'), JSON.parse(JSON.stringify(draft)));
  assert.equal(readDayDraft('user:yesterday'), undefined);
  assert.equal(readDayDraft('another-user:today'), undefined);
  writeDayDraft('user:today');
  assert.equal(readDayDraft('user:today'), undefined);
});
