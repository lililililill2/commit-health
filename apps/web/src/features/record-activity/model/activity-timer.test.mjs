import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityTimer } from './activity-timer.ts';

function fixture(override = {}) {
  let now = 0,
    tick,
    leave,
    visible = true;
  const calls = { complete: 0, fail: 0, heartbeat: 0 };
  const api = {
    start: async () => ({ id: 'test-session' }),
    heartbeat: async () => {
      calls.heartbeat++;
    },
    complete: async () => {
      calls.complete++;
    },
    fail: async () => {
      calls.fail++;
    },
    ...override,
  };
  const timer = createActivityTimer({
    api,
    onResult() {},
    environment: {
      now: () => now,
      visible: () => visible,
      every(fn) {
        tick = fn;
        return () => {
          tick = undefined;
        };
      },
      onLeave(fn) {
        leave = fn;
        return () => {
          leave = undefined;
        };
      },
    },
  });
  return {
    timer,
    calls,
    advance(ms) {
      now += ms;
      tick?.();
    },
    leave() {
      leave?.();
    },
    hide() {
      visible = false;
    },
  };
}
const flush = () => new Promise(setImmediate);

test('focus counts elapsed time and saves exactly once on explicit completion', async () => {
  const f = fixture();
  await f.timer.start();
  f.advance(1_000);
  assert.equal(f.timer.getSnapshot().seconds, 1);
  await f.timer.complete();
  await f.timer.complete();
  assert.equal(f.timer.getSnapshot().phase, 'completed');
  assert.equal(f.calls.complete, 1);
  assert.equal(f.calls.fail, 0);
});

test('leaving, hiding or disposing fails without awarding a completion', async () => {
  for (const action of ['leave', 'hide', 'dispose', 'cancel']) {
    const f = fixture();
    await f.timer.start();
    f.advance(2_000);
    if (action === 'leave') f.leave();
    if (action === 'hide') {
      f.hide();
      f.advance(1_000);
    }
    if (action === 'dispose') f.timer.dispose();
    if (action === 'cancel') f.timer.cancel();
    await flush();
    assert.equal(f.timer.getSnapshot().phase, 'failed');
    assert.equal(f.calls.fail, 1);
    assert.equal(f.calls.complete, 0);
  }
});

test('leaving while the start request is pending still fails the eventual server session', async () => {
  let resolveStart;
  const f = fixture({
    start: () =>
      new Promise((resolve) => {
        resolveStart = resolve;
      }),
  });
  const pending = f.timer.start();
  f.leave();
  resolveStart({ id: 'late-session' });
  await pending;
  await flush();
  assert.equal(f.timer.getSnapshot().phase, 'failed');
  assert.equal(f.calls.fail, 1);
});

test('network heartbeat failure and a long timer suspension cannot become success', async () => {
  const network = fixture({
    heartbeat: async () => {
      throw new Error('offline');
    },
  });
  await network.timer.start();
  network.advance(4_000);
  await flush();
  assert.equal(network.timer.getSnapshot().phase, 'failed');
  assert.equal(network.calls.complete, 0);
  const suspended = fixture();
  await suspended.timer.start();
  suspended.advance(180_000);
  await flush();
  assert.equal(suspended.timer.getSnapshot().phase, 'failed');
  assert.equal(suspended.calls.complete, 0);
});

test('no request starts while the page is already hidden, and a Strict Mode cleanup permits a fresh start', async () => {
  const hidden = fixture();
  hidden.hide();
  await hidden.timer.start();
  assert.equal(hidden.timer.getSnapshot().phase, 'failed');
  assert.equal(hidden.calls.fail, 0);
  const strict = fixture();
  strict.timer.dispose();
  await strict.timer.start();
  assert.equal(strict.timer.getSnapshot().phase, 'running');
  strict.timer.dispose();
});
