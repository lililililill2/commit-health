import { Box3, DirectionalLight, Group, PerspectiveCamera, SpotLight, Vector3 } from 'three';
import type { Object3D } from 'three';

export const MODEL_URL = '/models/dorm.glb';
export const FIELD_OF_VIEW = 40;
export const FRAME_FILL = 0.8;
export const ORBIT_MOTION = {
  enableDamping: true,
  dampingFactor: 0.075,
  rotateSpeed: 0.28,
  enableZoom: false,
} as const;
export const MIN_POLAR_ANGLE = (15 * Math.PI) / 180;
export const MAX_POLAR_ANGLE = (80 * Math.PI) / 180;
export const MIN_AZIMUTH_ANGLE = (-120 * Math.PI) / 180;
export const MAX_AZIMUTH_ANGLE = (120 * Math.PI) / 180;

export function initialViewDirection(): Vector3 {
  // Y is up in glTF; positive Z faces the open front of this dorm.
  return new Vector3(1, 1.4, 1.3).normalize();
}

export function prepareDormModel(source: Object3D) {
  const clone = source.clone(true);
  const sourceNodes: Object3D[] = [];
  const clonedNodes: Object3D[] = [];
  source.traverse((node) => sourceNodes.push(node));
  clone.traverse((node) => clonedNodes.push(node));
  const counterparts = new Map(sourceNodes.map((node, index) => [node, clonedNodes[index]]));

  // Three clones light targets separately. Reconnect targets that belong to the GLB hierarchy
  // so centering the whole scene does not change the imported light directions.
  sourceNodes.forEach((node, index) => {
    if (node instanceof DirectionalLight || node instanceof SpotLight) {
      const target = counterparts.get(node.target);
      if (target) (clonedNodes[index] as DirectionalLight | SpotLight).target = target;
    }
  });

  clone.updateWorldMatrix(true, true);
  const bounds = new Box3().setFromObject(clone, true);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  if (
    bounds.isEmpty() ||
    ![size.x, size.y, size.z].every((value) => Number.isFinite(value) && value > 0)
  )
    throw new Error('The dorm model does not have valid three-dimensional bounds');

  const root = new Group();
  root.name = 'CenteredDorm';
  root.position.copy(center).negate();
  root.add(clone);
  root.updateWorldMatrix(true, true);
  return { root, center, size };
}

export function fitDistance(
  size: Vector3,
  aspect: number,
  direction = initialViewDirection(),
): number {
  if (!Number.isFinite(aspect) || aspect <= 0)
    throw new Error('The viewport aspect ratio must be positive');
  const towardCamera = direction.clone().normalize();
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), towardCamera).normalize();
  if (towardCamera.lengthSq() === 0 || right.lengthSq() === 0)
    throw new Error('The camera direction must not be vertical or zero');
  const up = new Vector3().crossVectors(towardCamera, right).normalize();
  const tanVertical = Math.tan((FIELD_OF_VIEW * Math.PI) / 360);
  const tanHorizontal = tanVertical * aspect;
  let distance = size.length() * 0.6;
  for (const x of [-1, 1])
    for (const y of [-1, 1])
      for (const z of [-1, 1]) {
        const corner = new Vector3((x * size.x) / 2, (y * size.y) / 2, (z * size.z) / 2);
        const depth = corner.dot(towardCamera);
        distance = Math.max(
          distance,
          depth + Math.abs(corner.dot(right)) / (tanHorizontal * FRAME_FILL),
          depth + Math.abs(corner.dot(up)) / (tanVertical * FRAME_FILL),
        );
      }
  return distance;
}

export function cameraFrame(size: Vector3, aspect: number) {
  const radius = size.length() / 2;
  const distance = fitDistance(size, aspect);
  const minDistance = Math.max(radius * 1.15, distance * 0.65);
  const maxDistance = distance * 1.9;
  // Keep the background's fade-out inside the far clipping plane as the camera refits.
  return { distance, minDistance, maxDistance, near: radius / 100, far: maxDistance + radius * 10 };
}

export function frameCamera(
  camera: PerspectiveCamera,
  size: Vector3,
  aspect: number,
  first: boolean,
) {
  const frame = cameraFrame(size, aspect);
  const direction = first ? initialViewDirection() : camera.position.clone().normalize();
  const distance = Math.max(
    frame.minDistance,
    Math.min(frame.maxDistance, fitDistance(size, aspect, direction)),
  );
  camera.aspect = aspect;
  camera.near = frame.near;
  camera.far = frame.far;
  camera.position.copy(direction.multiplyScalar(distance));
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}
