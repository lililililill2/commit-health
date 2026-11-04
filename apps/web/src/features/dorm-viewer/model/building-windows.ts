import { Color, Object3D, StaticDrawUsage, type InstancedMesh } from 'three';

export const BUILDING_WINDOW_COUNT = 36;

// The original front/back panes and side strips share one unit box and material.
export function populateBuildingWindows(
  mesh: InstancedMesh,
  width: number,
  height: number,
  depth: number,
) {
  const transform = new Object3D();
  const blue = new Color('#93b4bb');
  const warm = new Color('#d8d8b8');
  let index = 0;
  const pane = (
    position: [number, number, number],
    size: [number, number, number],
    color: Color,
  ) => {
    transform.position.set(...position);
    transform.scale.set(...size);
    transform.updateMatrix();
    mesh.setMatrixAt(index, transform.matrix);
    mesh.setColorAt(index, color);
    index++;
  };

  for (let row = 0; row < 3; row++) {
    const y = 1.5 + (row * (height - 1.8)) / 3;
    for (const side of [-1, 1]) {
      for (const column of [-2, -1, 0, 1, 2])
        pane(
          [(column * width) / 6, y, side * (depth / 2 + 0.025)],
          [width / 9, 1.04, 0.06],
          row === 2 && column === -1 ? warm : blue,
        );
      pane([side * (width / 2 + 0.025), y, 0], [0.06, 1.04, depth * 0.5], blue);
    }
  }

  mesh.count = index;
  mesh.instanceMatrix.setUsage(StaticDrawUsage);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
}
