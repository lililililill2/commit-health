import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolvePoseLabels } from './stretch-config.ts';
import { createStretchProgress, DIRECTION_MS } from './stretch-progress.ts';

const pose = (label, probability = 0.9) => ({
  label,
  confidence: {
    left: label === 'left' ? probability : 0,
    right: label === 'right' ? probability : 0,
  },
});

function follow(timer, label, since, until, probability) {
  let result;
  for (let at = since; at <= until; at += 100) result = timer.sample(at, pose(label, probability));
  return result;
}

test('canonical default and the original export typo both map to the neutral pose', () => {
  const labels = { left: 'left', right: 'right', neutral: 'default' };
  const exercise = {
    modelUrl: 'https://teachablemachine.withgoogle.com/models/l8ZWiP8SW/',
    labels,
  };
  assert.deepEqual(resolvePoseLabels(exercise, ['right', 'default', 'left']), labels);
  assert.deepEqual(resolvePoseLabels(exercise, ['right', 'defalt', 'left']), {
    ...labels,
    neutral: 'defalt',
  });
  assert.equal(resolvePoseLabels(exercise, ['right', 'defalt', 'left', 'left']), null);
  assert.equal(resolvePoseLabels(exercise, ['right', 'Default', 'left']), null);
  assert.equal(
    resolvePoseLabels({ ...exercise, modelUrl: 'https://example.com/other/' }, [
      'right',
      'defalt',
      'left',
    ]),
    null,
  );
});

test('exactly 90% counts after stabilization and values below 90% never count', () => {
  const timer = createStretchProgress();
  assert.equal(follow(timer, 'left', 0, 1_000, 0.899).leftMs, 0);
  assert.equal(follow(timer, 'left', 1_100, 1_300).leftMs, 0);
  assert.equal(timer.sample(1_400, pose('left')).leftMs, 100);
  const low = timer.sample(1_500, pose('left', 0.899));
  assert.equal(low.leftMs, 100);
  assert.equal(low.confidence, 0.899);
});

test('neutral posture and the wrong side cannot advance either stage', () => {
  const timer = createStretchProgress();
  assert.equal(follow(timer, 'right', 0, 1_000, 0.99).leftMs, 0);
  assert.equal(follow(timer, 'neutral', 1_100, 2_100, 0.99).leftMs, 0);
  const switched = follow(timer, 'left', 2_200, 12_400);
  assert.equal(switched.direction, 'right');
  assert.equal(switched.leftMs, DIRECTION_MS);
  assert.equal(switched.rightMs, 0);
  assert.equal(switched.complete, false);
  assert.equal(follow(timer, 'left', 12_500, 13_500, 0.99).rightMs, 0);
  const completed = follow(timer, 'right', 13_600, 23_800);
  assert.equal(completed.rightMs, DIRECTION_MS);
  assert.equal(completed.complete, true);
});

test('a missing person, stale video and a paused page never make up elapsed time', () => {
  const timer = createStretchProgress();
  assert.equal(follow(timer, 'left', 0, 1_000).leftMs, 800);
  assert.equal(timer.sample(1_100, null).leftMs, 800);
  assert.equal(timer.sample(5_000, pose('left')).leftMs, 800);
  assert.equal(follow(timer, 'left', 5_100, 5_300).leftMs, 900);
  assert.equal(timer.sample(6_100, pose('left')).leftMs, 900);
  timer.pause();
  assert.equal(timer.sample(6_250, pose('left')).leftMs, 900);
  assert.equal(follow(timer, 'left', 6_350, 6_550).leftMs, 1_000);
});
