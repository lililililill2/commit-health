import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  FIELD_OF_VIEW,
  FRAME_FILL,
  MAX_AZIMUTH_ANGLE,
  MAX_POLAR_ANGLE,
  MIN_AZIMUTH_ANGLE,
  MIN_POLAR_ANGLE,
  ORBIT_MOTION,
  cameraFrame,
  fitDistance,
  frameCamera,
  initialViewDirection,
  prepareDormModel,
} from './view-config.ts';

const bytes = await readFile(new URL('../../../../public/models/dorm.glb', import.meta.url));
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  '',
);
const originalBounds = new Box3().setFromObject(gltf.scene, true);
const originalSize = originalBounds.getSize(new Vector3());

function nodes(root) {
  const result = [];
  root.traverse((node) => result.push(node));
  return result;
}

function assertFramed(camera, size) {
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const p = new Vector3((x * size.x) / 2, (y * size.y) / 2, (z * size.z) / 2).project(camera);
        assert.ok(
          Math.abs(p.x) <= FRAME_FILL + 0.000001,
          'Horizontal bounds must be inside the frame',
        );
        assert.ok(
          Math.abs(p.y) <= FRAME_FILL + 0.000001,
          'Vertical bounds must be inside the frame',
        );
        assert.ok(p.z > -1 && p.z < 1, 'The model must remain between the clipping planes');
      }
}

test('the actual GLB loads as a nonempty 3D room', () => {
  assert.ok(nodes(gltf.scene).some((node) => node.isMesh));
  assert.ok(
    [originalSize.x, originalSize.y, originalSize.z].every((n) => n > 0 && Number.isFinite(n)),
  );
});

test('centering preserves the original model scale and dimensions', () => {
  const model = prepareDormModel(gltf.scene);
  const bounds = new Box3().setFromObject(model.root, true);
  assert.ok(bounds.getCenter(new Vector3()).length() < 0.000001);
  assert.ok(bounds.getSize(new Vector3()).distanceTo(originalSize) < 0.000001);
  assert.deepEqual(model.root.scale.toArray(), [1, 1, 1]);
});

test('all original furniture, geometry, materials, and local transforms are retained', () => {
  const source = nodes(gltf.scene);
  const copy = nodes(prepareDormModel(gltf.scene).root.children[0]);
  assert.equal(source.length, copy.length);
  source.forEach((node, i) => {
    assert.equal(copy[i].name, node.name);
    assert.deepEqual(copy[i].position.toArray(), node.position.toArray());
    assert.deepEqual(copy[i].quaternion.toArray(), node.quaternion.toArray());
    assert.deepEqual(copy[i].scale.toArray(), node.scale.toArray());
    if (node.isMesh) {
      assert.equal(copy[i].geometry, node.geometry);
      assert.equal(copy[i].material, node.material);
    }
  });
});

test('the imported directional light keeps its direction after cloning and centering', () => {
  const source = nodes(gltf.scene);
  const copy = nodes(prepareDormModel(gltf.scene).root.children[0]);
  source.forEach((node, i) => {
    if (!node.isDirectionalLight) return;
    const before = node.target
      .getWorldPosition(new Vector3())
      .sub(node.getWorldPosition(new Vector3()))
      .normalize();
    const after = copy[i].target
      .getWorldPosition(new Vector3())
      .sub(copy[i].getWorldPosition(new Vector3()))
      .normalize();
    assert.ok(before.distanceTo(after) < 0.000001);
    assert.ok(copy.includes(copy[i].target));
  });
});

test('the initial three-quarter camera is above the open front and inside the orbit limits', () => {
  const direction = initialViewDirection();
  const polar = Math.acos(direction.y);
  const azimuth = Math.atan2(direction.x, direction.z);
  assert.ok(direction.y > 0 && direction.z > 0);
  assert.ok(polar >= MIN_POLAR_ANGLE && polar <= MAX_POLAR_ANGLE);
  assert.ok(azimuth >= MIN_AZIMUTH_ANGLE && azimuth <= MAX_AZIMUTH_ANGLE);
});

for (const aspect of [320 / 900, 1, 1440 / 900, 2560 / 1080]) {
  test(`all eight room bounds fit at viewport aspect ${aspect}`, () => {
    const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect);
    frameCamera(camera, originalSize, aspect, true);
    assertFramed(camera, originalSize);
  });
}

test('zoom limits keep the camera outside the model and avoid an excessively distant view', () => {
  for (const aspect of [0.35, 1, 1.6, 2.4]) {
    const frame = cameraFrame(originalSize, aspect);
    const radius = originalSize.length() / 2;
    assert.ok(frame.minDistance > radius);
    assert.ok(frame.minDistance <= frame.distance && frame.maxDistance > frame.distance);
    assert.ok(frame.maxDistance < frame.distance * 2);
    assert.ok(frame.near < frame.minDistance - radius);
    assert.ok(frame.far > frame.maxDistance + radius);
  }
});

test('resizing refits the room without resetting the chosen viewing direction', () => {
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1.6);
  for (const [polar, azimuth] of [
    [Math.PI / 4, -Math.PI / 6],
    [MIN_POLAR_ANGLE, MIN_AZIMUTH_ANGLE],
    [MAX_POLAR_ANGLE, MAX_AZIMUTH_ANGLE],
  ]) {
    frameCamera(camera, originalSize, 1.6, true);
    const direction = new Vector3().setFromSphericalCoords(1, polar, azimuth);
    camera.position.copy(direction.clone().multiplyScalar(camera.position.length()));
    for (const aspect of [0.4, 2.4]) {
      frameCamera(camera, originalSize, aspect, false);
      assert.ok(camera.position.clone().normalize().distanceTo(direction) < 0.000001);
      assertFramed(camera, originalSize);
    }
  }
});

test('invalid viewport ratios fail explicitly rather than producing an invalid camera', () => {
  for (const aspect of [0, -1, NaN, Infinity])
    assert.throws(() => fitDistance(originalSize, aspect), /aspect ratio/);
});

test('an empty model fails explicitly for the error boundary', () => {
  assert.throws(() => prepareDormModel(new gltf.scene.constructor()), /bounds/);
});

test('the same OrbitControls used by Drei slows down gradually after a rotation input', () => {
  const require = createRequire(import.meta.url);
  const dreiRequire = createRequire(require.resolve('@react-three/drei'));
  const { OrbitControls } = dreiRequire('three-stdlib');
  const camera = new PerspectiveCamera(FIELD_OF_VIEW, 1.6);
  frameCamera(camera, originalSize, 1.6, true);
  const controls = new OrbitControls(camera);
  Object.assign(controls, ORBIT_MOTION);
  const start = controls.getAzimuthalAngle();
  const destination = start + 0.3;
  controls.setAzimuthalAngle(destination);
  let previous = controls.getAzimuthalAngle();
  let previousDelta = Infinity;
  for (let i = 0; i < 20; i++) {
    controls.update();
    const next = controls.getAzimuthalAngle();
    const delta = next - previous;
    assert.ok(delta > 0, 'Motion must continue after the input ends');
    assert.ok(delta < previousDelta, 'The remaining motion must get smaller on each frame');
    previous = next;
    previousDelta = delta;
  }
  for (let i = 0; i < 200; i++) controls.update();
  assert.ok(Math.abs(controls.getAzimuthalAngle() - destination) < 0.000001);
});
