import assert from 'node:assert/strict';
import test from 'node:test';

import { createSessionActivity, observeSessionActivity } from './session-activity.ts';

const settle = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function harness(renew) {
  let now = 0;
  let visible = true;
  const jobs = new Map();
  const signals = [];
  const errors = [];
  const tracker = createSessionActivity({
    now: () => now,
    visible: () => visible,
    schedule(callback, delay) {
      const id = Symbol();
      jobs.set(id, { at: now + delay, callback });
      return () => jobs.delete(id);
    },
    renew(signal) {
      signals.push(signal);
      return renew?.() ?? Promise.resolve();
    },
    onError: (error) => errors.push(error),
  });
  return {
    tracker,
    signals,
    errors,
    visible(value) {
      visible = value;
    },
    async advance(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...jobs.entries()]
          .filter(([, job]) => job.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        jobs.delete(next[0]);
        now = next[1].at;
        next[1].callback();
        await settle();
      }
      now = end;
      await settle();
    },
  };
}

test('real activity is coalesced and no idle timer keeps a session alive', async () => {
  const h = harness();
  h.tracker.activity();
  await settle();
  assert.equal(h.signals.length, 1);
  await h.advance(30_000);
  for (let i = 0; i < 100; i++) h.tracker.activity();
  await h.advance(30_000);
  assert.equal(h.signals.length, 2);
  await h.advance(2 * 86_400_000);
  assert.equal(h.signals.length, 2);
  h.tracker.stop();
});

test('hidden activity cannot renew, while returning to the page can', async () => {
  const h = harness();
  h.visible(false);
  h.tracker.activity();
  await h.advance(60_000);
  assert.equal(h.signals.length, 0);
  h.visible(true);
  h.tracker.activity();
  await settle();
  assert.equal(h.signals.length, 1);
  h.visible(false);
  h.tracker.activity();
  await h.advance(86_400_000);
  assert.equal(h.signals.length, 1);
  h.visible(true);
  h.tracker.activity();
  await settle();
  assert.equal(h.signals.length, 2);
  h.tracker.stop();
});

test('overlapping activity requests are serialized and cleanup aborts pending work', async () => {
  let resolve;
  const h = harness(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  h.tracker.activity();
  h.tracker.activity();
  await h.advance(60_000);
  assert.equal(h.signals.length, 1);
  resolve();
  await settle();
  assert.equal(h.signals.length, 2);
  h.tracker.stop();
  assert.equal(h.signals[1].aborted, true);
  resolve();
  await settle();
  h.tracker.activity();
  await h.advance(60_000);
  assert.equal(h.signals.length, 2);
});

test('network errors do not generate automatic renewal retries', async () => {
  const h = harness(() => Promise.reject(new Error('synthetic network failure')));
  h.tracker.activity();
  await settle();
  assert.equal(h.errors.length, 1);
  await h.advance(86_400_000);
  assert.equal(h.signals.length, 1);
  h.tracker.activity();
  await settle();
  assert.equal(h.signals.length, 2);
  h.tracker.stop();
});

test('the event observer ignores synthetic, unfocused and hidden events and cleans up', () => {
  class TrustedEvent extends Event {
    get isTrusted() {
      return true;
    }
  }
  class Document extends EventTarget {
    visibilityState = 'visible';
    focused = true;
    hasFocus() {
      return this.focused;
    }
  }
  const doc = new Document(),
    win = new EventTarget();
  let count = 0;
  const unsubscribe = observeSessionActivity(doc, win, () => count++);
  assert.equal(count, 1);
  doc.dispatchEvent(new Event('pointermove'));
  assert.equal(count, 1);
  doc.dispatchEvent(new TrustedEvent('pointermove'));
  assert.equal(count, 2);
  doc.visibilityState = 'hidden';
  win.dispatchEvent(new TrustedEvent('focus'));
  assert.equal(count, 2);
  doc.visibilityState = 'visible';
  doc.focused = false;
  doc.dispatchEvent(new TrustedEvent('visibilitychange'));
  assert.equal(count, 2);
  doc.focused = true;
  doc.dispatchEvent(new TrustedEvent('visibilitychange'));
  assert.equal(count, 3);
  unsubscribe();
  doc.dispatchEvent(new TrustedEvent('keydown'));
  assert.equal(count, 3);
});
