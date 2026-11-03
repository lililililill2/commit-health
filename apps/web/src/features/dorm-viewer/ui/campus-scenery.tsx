'use client';

import { useFrame } from '@react-three/fiber';
import { useCallback, useRef, type ReactNode } from 'react';
import { Mesh, Sprite, type Group, type InstancedMesh, type Material } from 'three';

import { sceneryVisibility } from '../model/backdrop-config';
import { BUILDING_WINDOW_COUNT, populateBuildingWindows } from '../model/building-windows';

type Triple = [number, number, number];
type FadingMaterial = { material: Material; opacity: number; depthWrite: boolean };

function setSceneryOpacity(materials: FadingMaterial[], opacity: number) {
  for (const entry of materials) {
    entry.material.opacity = entry.opacity * opacity;
    entry.material.depthWrite = opacity > 0.99 && entry.depthWrite;
  }
}

function Block({ position, size, color }: { position: Triple; size: Triple; color: string }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={1} />
    </mesh>
  );
}

// Only background materials are faded. The imported GLB never enters this group.
export function SceneryGroup({
  x,
  z,
  floorY,
  children,
}: {
  x: number;
  z: number;
  floorY: number;
  children: ReactNode;
}) {
  const group = useRef<Group | null>(null);
  const materials = useRef<FadingMaterial[]>([]);
  const lastOpacity = useRef(-1);
  const attach = useCallback((node: Group | null) => {
    group.current = node;
    materials.current = [];
    lastOpacity.current = -1;
    if (!node) return;
    const unique = new Set<Material>();
    node.traverse((child) => {
      if (child instanceof Mesh || child instanceof Sprite)
        for (const material of Array.isArray(child.material) ? child.material : [child.material])
          unique.add(material);
    });
    materials.current = [...unique].map((material) => {
      material.transparent = true;
      material.needsUpdate = true;
      return { material, opacity: material.opacity, depthWrite: material.depthWrite };
    });
    // Restore properties before a Strict Mode ref reattachment or disposal.
    return () => {
      setSceneryOpacity(materials.current, 1);
      materials.current = [];
      group.current = null;
    };
  }, []);

  useFrame(({ camera }) => {
    const opacity = sceneryVisibility(x, z, camera.position);
    if (Math.abs(opacity - lastOpacity.current) < 0.001) return;
    lastOpacity.current = opacity;
    if (group.current) group.current.visible = opacity > 0.005;
    setSceneryOpacity(materials.current, opacity);
  });

  return (
    <group ref={attach} position={[x, floorY, z]}>
      {children}
    </group>
  );
}

function CampusWindows({ width, height, depth }: { width: number; height: number; depth: number }) {
  const attach = useCallback(
    (mesh: InstancedMesh | null) => {
      if (mesh) populateBuildingWindows(mesh, width, height, depth);
    },
    [width, height, depth],
  );
  return (
    <instancedMesh ref={attach} args={[undefined, undefined, BUILDING_WINDOW_COUNT]}>
      <boxGeometry />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}

export function CampusBuilding({
  width,
  height,
  depth,
  color,
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
}) {
  return (
    <group>
      <Block position={[0, 0.09, 0]} size={[width + 1.5, 0.18, depth + 1.5]} color="#d6d0bc" />
      <Block position={[0, height / 2 + 0.18, 0]} size={[width, height, depth]} color={color} />
      <Block position={[0, 0.5, 0]} size={[width + 0.1, 0.6, depth + 0.1]} color="#b2baae" />
      <Block
        position={[0, height + 0.3, 0]}
        size={[width + 0.5, 0.28, depth + 0.5]}
        color="#7d9697"
      />
      <Block
        position={[0, height + 0.5, 0]}
        size={[width - 0.4, 0.18, depth - 0.4]}
        color="#a7b9b4"
      />
      <CampusWindows width={width} height={height} depth={depth} />
      <Block position={[0, 1, depth / 2 + 0.07]} size={[1.35, 1.65, 0.12]} color="#718e90" />
      <Block position={[0, 2.05, depth / 2 + 0.55]} size={[2.2, 0.13, 1.2]} color="#7d9697" />
      <Block position={[0, 0.16, depth / 2 + 0.8]} size={[2.5, 0.2, 1.4]} color="#e4ddcc" />
    </group>
  );
}

export function CampusTree({
  scale,
  phase,
  animate,
}: {
  scale: number;
  phase: number;
  animate: boolean;
}) {
  const crown = useRef<Group>(null);
  const time = useRef(0);
  useFrame((_, delta) => {
    if (!animate || !crown.current) return;
    time.current += Math.min(delta, 0.05);
    crown.current.rotation.z = Math.sin(time.current * 1.3 + phase) * 0.045;
    crown.current.rotation.x = Math.cos(time.current * 0.85 + phase) * 0.025;
  });

  return (
    <group scale={scale}>
      <mesh
        position={[-0.55, 0.015, 0.35]}
        rotation={[-Math.PI / 2, 0, -0.45]}
        scale={[1.4, 0.8, 1]}
      >
        <circleGeometry args={[1.8, 24]} />
        <meshBasicMaterial color="#617454" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.13, 0.21, 2, 7]} />
        <meshStandardMaterial color="#a89578" roughness={1} />
      </mesh>
      <group ref={crown} position={[0, 1.4, 0]}>
        <mesh position={[-0.42, 1.05, 0.12]} scale={[1.1, 1.2, 1]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#9eb780" roughness={1} flatShading />
        </mesh>
        <mesh position={[0.5, 1.2, -0.12]} scale={[0.95, 1.3, 1]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#adc28c" roughness={1} flatShading />
        </mesh>
        <mesh position={[0, 2, 0]} scale={[1, 1.05, 0.95]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#b8cc98" roughness={1} flatShading />
        </mesh>
      </group>
    </group>
  );
}

export function CampusBench() {
  return (
    <group>
      <Block position={[0, 0.5, 0]} size={[2.1, 0.14, 0.65]} color="#b8a183" />
      <Block position={[0, 0.94, -0.26]} size={[2.1, 0.55, 0.12]} color="#c3ad8e" />
      {[-0.75, 0.75].map((x) => (
        <Block key={x} position={[x, 0.25, 0]} size={[0.13, 0.5, 0.5]} color="#7e9087" />
      ))}
    </group>
  );
}
