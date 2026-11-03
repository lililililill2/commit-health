'use client';

import { useMemo } from 'react';
import { LinearFilter, SRGBColorSpace } from 'three';

import { cloudPixels } from '../model/cloud-texture';
import { SceneryGroup } from './campus-scenery';

const CLOUDS = [
  { x: -24, z: -20, height: 10, width: 14, depth: 6.1, seed: 17 },
  { x: -16, z: -34, height: 12, width: 18, depth: 7.8, seed: 43 },
  { x: 10, z: -12, height: 8, width: 10, depth: 4.4, seed: 91 },
  { x: -31, z: -10, height: 9, width: 12, depth: 5.2, seed: 128 },
  { x: 2, z: -38, height: 11, width: 13.6, depth: 5.7, seed: 163 },
  { x: 28, z: -20, height: 13, width: 15, depth: 6.3, seed: 207 },
  { x: -36, z: 4, height: 10.5, width: 16, depth: 6.7, seed: 241 },
  { x: -28, z: 25, height: 12, width: 17.5, depth: 7.3, seed: 277 },
  { x: -12, z: 35, height: 10, width: 15, depth: 6.4, seed: 313 },
  { x: 8, z: 37, height: 11.5, width: 16.5, depth: 7, seed: 349 },
  { x: 25, z: 29, height: 9.5, width: 15.5, depth: 6.7, seed: 389 },
  { x: 36, z: 13, height: 12, width: 17, depth: 7.3, seed: 421 },
  { x: 38, z: -7, height: 10, width: 15, depth: 6.4, seed: 457 },
] as const;

function SoftCloud({ width, depth, seed }: { width: number; depth: number; seed: number }) {
  const pixels = useMemo(() => cloudPixels(seed), [seed]);
  return (
    <sprite scale={[width, depth, 1]}>
      <spriteMaterial
        color="#f0f7ff"
        transparent
        opacity={0.75}
        depthWrite={false}
        toneMapped={false}
        fog
      >
        <dataTexture
          attach="map"
          args={[pixels.data, pixels.width, pixels.height]}
          colorSpace={SRGBColorSpace}
          minFilter={LinearFilter}
          magFilter={LinearFilter}
          needsUpdate
        />
      </spriteMaterial>
    </sprite>
  );
}

export function CampusClouds() {
  return CLOUDS.map((cloud) => (
    <SceneryGroup key={cloud.seed} x={cloud.x} z={cloud.z} floorY={cloud.height}>
      <SoftCloud width={cloud.width} depth={cloud.depth} seed={cloud.seed} />
    </SceneryGroup>
  ));
}
