import assert from 'node:assert/strict';
import test from 'node:test';
import { createMeditationPlayer, playedSeconds } from './meditation-player.ts';

const ranges = (segments) => ({
  length: segments.length,
  start: (index) => segments[index][0],
  end: (index) => segments[index][1],
});

class Audio extends EventTarget {
  paused = true;
  playingTime = 0;
  played = ranges([]);
  currentTime = 0;
  playbackRate = 1;

  async play() {
    this.paused = false;
    this.dispatchEvent(new Event('playing'));
  }

  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }

  removeAttribute() {
    this.src = undefined;
  }
  load() {
    this.currentTime = 0;
  }

  advance(seconds) {
    if (this.paused) return;
    this.playingTime += seconds;
    this.currentTime += seconds;
    this.played = ranges([[0, this.playingTime]]);
  }
}

function fixture(apiOverrides = {}) {
  let now = 0;
  let tick;
  const calls = { save: [], fail: [], ping: [] };
  const audio = new Audio();
  const player = createMeditationPlayer({
    audioPath: '/meditation.mp3',
    minimumSeconds: 180,
    api: {
      start: async () => ({ id: 'meditation' }),
      heartbeat: async (id) => {
        calls.ping.push(id);
      },
      completeMeditation: async (...args) => {
        calls.save.push(args);
      },
      fail: async (id) => {
        calls.fail.push(id);
      },
      ...apiOverrides,
    },
    now: () => now,
    every(fn) {
      tick = fn;
      return () => {
        tick = undefined;
      };
    },
    onResult() {},
    describeError: () => 'Could not start',
  });
  return {
    player,
    audio,
    calls,
    advance(seconds, buffering = false) {
      now += seconds * 1_000;
      if (!buffering) audio.advance(seconds);
      tick?.();
    },
  };
}

const flush = () => new Promise(setImmediate);

test('counts positions that played and floors fractional time without counting gaps', () => {
  assert.equal(playedSeconds(ranges([])), 0);
  assert.equal(playedSeconds(ranges([[0, 179.999]])), 179);
  assert.equal(
    playedSeconds(
      ranges([
        [0, 40],
        [100, 239],
      ]),
    ),
    179,
  );
  assert.equal(
    playedSeconds(
      ranges([
        [0, 40],
        [100, 240],
      ]),
    ),
    180,
  );
});

test('pause and buffering do not count toward 180 seconds, and playback can continue after a single save', async () => {
  const f = fixture();
  assert.equal(f.audio.src, undefined);
  await f.player.start(f.audio);
  f.advance(80);
  await flush();
  f.player.togglePlayback();
  f.advance(30);
  await flush();
  assert.equal(f.player.getSnapshot().seconds, 80);
  assert.equal(f.calls.ping.length, 2);
  f.player.togglePlayback();
  f.advance(20, true);
  assert.equal(f.player.getSnapshot().seconds, 80);
  f.advance(99);
  assert.equal(f.calls.save.length, 0);
  f.advance(1);
  await flush();
  assert.deepEqual(f.calls.save, [['meditation', 180]]);
  assert.equal(f.player.getSnapshot().record, 'saved');
  assert.equal(f.audio.paused, false);
  f.advance(30);
  assert.equal(f.player.getSnapshot().seconds, 210);
  f.player.finish();
  assert.equal(f.audio.paused, true);
  assert.equal(f.calls.save.length, 1);
  assert.deepEqual(f.calls.fail, []);
});

test('guards seek and playback rate, and leaving early releases audio without saving', async () => {
  const f = fixture();
  await f.player.start(f.audio);
  f.advance(10);
  f.audio.currentTime = 200;
  f.audio.dispatchEvent(new Event('seeking'));
  assert.equal(f.audio.currentTime, 10);
  f.audio.playbackRate = 2;
  f.audio.dispatchEvent(new Event('ratechange'));
  assert.equal(f.audio.playbackRate, 1);
  f.player.leave();
  assert.equal(f.audio.paused, true);
  assert.equal(f.audio.src, undefined);
  assert.deepEqual(f.calls.fail, ['meditation']);
  assert.deepEqual(f.calls.save, []);
});

test('an ended track or failed sound before the minimum cannot save', async () => {
  for (const event of ['ended', 'error']) {
    const f = fixture();
    await f.player.start(f.audio);
    f.advance(100);
    f.audio.dispatchEvent(new Event(event));
    assert.equal(f.player.getSnapshot().phase, 'finished');
    assert.deepEqual(f.calls.save, []);
    assert.deepEqual(f.calls.fail, ['meditation']);
  }
});

test('a retry after an uncertain save reuses the same activity id', async () => {
  const saves = [];
  const f = fixture({
    async completeMeditation(...args) {
      saves.push(args);
      if (saves.length === 1) throw new Error('lost response');
    },
  });
  await f.player.start(f.audio);
  f.advance(180);
  await flush();
  assert.equal(f.player.getSnapshot().record, 'retry');
  f.player.retrySave();
  await flush();
  assert.equal(f.player.getSnapshot().record, 'saved');
  assert.deepEqual(saves, [
    ['meditation', 180],
    ['meditation', 180],
  ]);
  f.player.leave();
  assert.deepEqual(f.calls.fail, []);
});

test('ending before the start response still cleans up the eventual session', async () => {
  let resolveStart;
  const f = fixture({
    start: () =>
      new Promise((resolve) => {
        resolveStart = resolve;
      }),
  });
  const starting = f.player.start(f.audio);
  f.player.leave();
  resolveStart({ id: 'late' });
  await starting;
  assert.equal(f.audio.src, undefined);
  assert.deepEqual(f.calls.fail, ['late']);
});
