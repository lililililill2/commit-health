import type { Vector3 } from 'three';

export const BACKDROP_COLOR = '#9bccef';
export const BACKDROP_TEXTURE_URL = '/backgrounds/courtyard-pavers.svg';

// Keep the open court around the original room; scenery starts beyond its footprint.
export const CAMPUS_BUILDINGS = [
  { x: -14, z: -6, width: 7, height: 5.4, depth: 4.2, color: '#e9dfca' },
  { x: 8, z: -14, width: 7.8, height: 6.2, depth: 4.8, color: '#dce4d9' },
] as const;

export const CAMPUS_TREES = [
  { x: -10, z: -12, scale: 1 },
  { x: -14, z: 1, scale: 0.85 },
  { x: -16, z: 12, scale: 1.1 },
  { x: 13, z: -8, scale: 0.95 },
  { x: 16, z: 4, scale: 1.05 },
  { x: 17, z: 16, scale: 0.9 },
  { x: -7, z: -22, scale: 1.15 },
  { x: 4, z: -25, scale: 1.1 },
] as const;

export function sceneryVisibility(x: number, z: number, camera: Pick<Vector3, 'x' | 'z'>) {
  const length = Math.hypot(x, z) * Math.hypot(camera.x, camera.z);
  const facing = length > 0 ? (x * camera.x + z * camera.z) / length : -1;
  // Foreground scenery fades away before it can hide the room or surround the camera.
  const t = Math.max(0, Math.min(1, (facing - 0.05) / 0.45));
  return 1 - t * t * (3 - 2 * t);
}

export function backdropFrame(size: Vector3, maxDistance: number) {
  const extent = Math.max(240, maxDistance * 6);
  return {
    radius: size.length() / 2,
    floorY: -size.y / 2 - 0.05,
    extent,
  };
}

export function backdropFog(distance: number, radius: number) {
  return { near: distance + radius * 2, far: distance + radius * 8 };
}
