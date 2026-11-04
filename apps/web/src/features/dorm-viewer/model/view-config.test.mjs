import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  Box3,
  BoxGeometry,
  Color,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  PerspectiveCamera,
  Ray,
  StaticDrawUsage,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import {
  CAMPUS_BUILDINGS,
  CAMPUS_TREES,
  backdropFog,
  backdropFrame,
  sceneryVisibility,
} from './backdrop-config.ts';
import { BUILDING_WINDOW_COUNT, populateBuildingWindows } from './building-windows.ts';
import { createOrbitActivity } from './orbit-activity.ts';
import { WebGLUnavailableError, classifyRendererError, viewerErrorKind } from './viewer-error.ts';
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

test('unavailable WebGL has its own status and retains the renderer failure as its cause', () => {
  const cause = new Error('Renderer initialization failed');
  const error = classifyRendererError(cause, () => null);
  assert.ok(error instanceof WebGLUnavailableError);
  assert.equal(error.cause, cause);
  assert.equal(viewerErrorKind(error), 'unsupported');
});

test('a supported context with a renderer failure stays a generic error', () => {
  const cause = new Error('Renderer initialization failed');
  const context = { isContextLost: () => false };
  const error = classifyRendererError(cause, () => context);
  assert.equal(error, cause);
  assert.equal(viewerErrorKind(error), 'error');
});

test('a throwing capability check preserves the original renderer failure', () => {
  const cause = new Error('Renderer initialization failed');
  const error = classifyRendererError(cause, () => {
    throw new Error('Capability check failed');
  });
  assert.equal(error, cause);
  assert.equal(viewerErrorKind(error), 'error');
});

test('model, context-loss and unknown errors are never classified by their message', () => {
  for (const error of [
    new Error('Failed to load /models/dorm.glb'),
    new Error('The WebGL context was lost'),
    new Error('WebGL 2 is unavailable'),
    'WebGL 2 is unavailable',
    null,
    undefined,
  ]) {
    assert.equal(viewerErrorKind(error), 'error');
  }
});

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

test('camera distance bounds keep it outside the model and avoid an excessively distant view', () => {
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

test('the 3D floor stays below the actual room and contains the full camera orbit', () => {
  const bounds = new Box3().setFromObject(prepareDormModel(gltf.scene).root, true);
  for (const aspect of [0.35, 1, 1.6, 2.4]) {
    const camera = cameraFrame(originalSize, aspect);
    const backdrop = backdropFrame(originalSize, camera.maxDistance);
    assert.ok(backdrop.floorY < bounds.min.y, 'The floor must never intersect the room');
    assert.ok(bounds.min.y - backdrop.floorY < 0.1, 'The room must rest close to the floor');
    assert.ok(backdrop.extent / 2 > camera.maxDistance + backdrop.radius);
  }
});

test('background fog leaves the room untouched and fades before the far clipping plane', () => {
  for (const aspect of [0.35, 1, 1.6, 2.4]) {
    const frame = cameraFrame(originalSize, aspect);
    const backdrop = backdropFrame(originalSize, frame.maxDistance);
    for (const distance of [frame.minDistance, frame.distance, frame.maxDistance])
      for (const [polar, azimuth] of [
        [MIN_POLAR_ANGLE, MIN_AZIMUTH_ANGLE],
        [MAX_POLAR_ANGLE, MAX_AZIMUTH_ANGLE],
      ]) {
        const camera = new PerspectiveCamera(FIELD_OF_VIEW, aspect, frame.near, frame.far);
        camera.position.setFromSphericalCoords(distance, polar, azimuth);
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        const fog = backdropFog(distance, backdrop.radius);
        assert.ok(fog.far < camera.far, 'The background must fade before it is clipped');
        for (const x of [-1, 1])
          for (const y of [-1, 1])
            for (const z of [-1, 1]) {
              const corner = new Vector3(
                (x * originalSize.x) / 2,
                (y * originalSize.y) / 2,
                (z * originalSize.z) / 2,
              ).applyMatrix4(camera.matrixWorldInverse);
              assert.ok(-corner.z < fog.near, 'No part of the room may enter the fog');
            }
      }
  }
});

test('campus scenery stays outside the room and fades wherever it would obstruct the view', () => {
  const floorY = -originalSize.y / 2 - 0.05;
  const room = new Box3(
    originalSize.clone().multiplyScalar(-0.5),
    originalSize.clone().multiplyScalar(0.5),
  );
  const scenery = [
    ...CAMPUS_BUILDINGS.map((building) => ({
      ...building,
      halfX: (building.width + 1.5) / 2,
      halfZ: (building.depth + 2.8) / 2,
      top: building.height + 0.7,
    })),
    ...CAMPUS_TREES.map((tree) => ({
      ...tree,
      halfX: 1.8 * tree.scale,
      halfZ: 1.6 * tree.scale,
      top: 4.5 * tree.scale,
    })),
  ];
  const targets = [new Vector3()];
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1])
        targets.push(
          new Vector3((x * originalSize.x) / 2, (y * originalSize.y) / 2, (z * originalSize.z) / 2),
        );
  for (const item of scenery) {
    const bounds = new Box3(
      new Vector3(item.x - item.halfX, floorY, item.z - item.halfZ),
      new Vector3(item.x + item.halfX, floorY + item.top, item.z + item.halfZ),
    );
    assert.ok(!bounds.intersectsBox(room), 'Scenery must not enter the original room');
    for (const aspect of [0.35, 1, 1.6, 2.4]) {
      const frame = cameraFrame(originalSize, aspect);
      for (const distance of [frame.minDistance, frame.distance, frame.maxDistance])
        for (const polar of [MIN_POLAR_ANGLE, Math.PI / 4, MAX_POLAR_ANGLE])
          for (
            let azimuth = MIN_AZIMUTH_ANGLE;
            azimuth <= MAX_AZIMUTH_ANGLE;
            azimuth += Math.PI / 12
          ) {
            const camera = new Vector3().setFromSphericalCoords(distance, polar, azimuth);
            for (const target of targets) {
              const ray = new Ray(camera, target.clone().sub(camera).normalize());
              const hit = ray.intersectBox(bounds, new Vector3());
              if (
                bounds.containsPoint(camera) ||
                (hit && hit.distanceTo(camera) < target.distanceTo(camera))
              )
                assert.ok(
                  sceneryVisibility(item.x, item.z, camera) < 0.005,
                  'Foreground scenery must disappear before obstructing the room',
                );
            }
          }
    }
  }
});

test('instanced building windows retain every pane, original bounds, and both colors', () => {
  for (const building of CAMPUS_BUILDINGS) {
    const geometry = new BoxGeometry();
    const material = new MeshStandardMaterial();
    const mesh = new InstancedMesh(geometry, material, BUILDING_WINDOW_COUNT);
    populateBuildingWindows(mesh, building.width, building.height, building.depth);
    assert.equal(mesh.count, 36);
    assert.equal(mesh.instanceMatrix.usage, StaticDrawUsage);
    assert.ok(mesh.boundingBox && mesh.boundingSphere);
    const expectedMin = new Vector3(-building.width / 2 - 0.055, 0.98, -building.depth / 2 - 0.055);
    const expectedMax = new Vector3(
      building.width / 2 + 0.055,
      2.02 + (2 * (building.height - 1.8)) / 3,
      building.depth / 2 + 0.055,
    );
    assert.ok(mesh.boundingBox.min.distanceTo(expectedMin) < 0.000001);
    assert.ok(mesh.boundingBox.max.distanceTo(expectedMax) < 0.000001);
    const counts = new Map();
    for (let i = 0; i < mesh.count; i++) {
      const color = new Color();
      mesh.getColorAt(i, color);
      const key = color.getHexString();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      const matrix = new Matrix4();
      mesh.getMatrixAt(i, matrix);
      const bounds = new Box3()
        .setFromBufferAttribute(geometry.attributes.position)
        .applyMatrix4(matrix);
      for (const x of [bounds.min.x, bounds.max.x])
        for (const y of [bounds.min.y, bounds.max.y])
          for (const z of [bounds.min.z, bounds.max.z])
            assert.ok(mesh.boundingSphere.distanceToPoint(new Vector3(x, y, z)) < 0.000001);
    }
    assert.deepEqual(Object.fromEntries(counts), { '93b4bb': 34, d8d8b8: 2 });
    assert.equal(
      material.color.getHexString(),
      'ffffff',
      'Instance colors must not tint the shared material',
    );
    mesh.dispose();
    geometry.dispose();
    material.dispose();
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

test('UI stays hidden through dragging and the remaining camera damping', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const changes = [];
  const activity = createOrbitActivity((active) => changes.push(active));
  activity.change();
  assert.deepEqual(changes, [], 'Initial camera fitting must not hide the UI');
  activity.start();
  activity.start();
  activity.change();
  context.mock.timers.tick(1000);
  assert.deepEqual(changes, [true], 'Dragging must stay active without repeated React updates');
  activity.end();
  context.mock.timers.tick(100);
  activity.change();
  context.mock.timers.tick(179);
  assert.deepEqual(changes, [true], 'Damping must extend the hidden period after pointer release');
  context.mock.timers.tick(1);
  assert.deepEqual(changes, [true, false]);
  activity.dispose();
});

test('starting another drag cancels a pending UI reveal', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const changes = [];
  const activity = createOrbitActivity((active) => changes.push(active));
  activity.start();
  activity.end();
  context.mock.timers.tick(100);
  activity.start();
  context.mock.timers.tick(500);
  assert.deepEqual(changes, [true]);
  activity.end();
  context.mock.timers.tick(180);
  assert.deepEqual(changes, [true, false]);
  activity.dispose();
});

test('unmount cleanup cancels delayed callbacks and supports a Strict Mode reattachment', (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const changes = [];
  const activity = createOrbitActivity((active) => changes.push(active));
  activity.start();
  activity.end();
  activity.dispose();
  context.mock.timers.tick(500);
  assert.deepEqual(changes, [true, false], 'Unmount must restore the UI and cancel the timer');
  activity.start();
  activity.end();
  context.mock.timers.tick(180);
  assert.deepEqual(changes, [true, false, true, false]);
  activity.dispose();
});
