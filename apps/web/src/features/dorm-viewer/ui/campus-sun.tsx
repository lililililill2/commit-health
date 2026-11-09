'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { LinearFilter, SRGBColorSpace, Vector3, type Sprite } from 'three';

import { sunPixels } from '../model/sun-texture';

const SUN_DIRECTION = new Vector3(-0.75, 0.08, -0.66).normalize();
const HALO_DIAMETER = (10 * Math.PI) / 180;

export function CampusSun() {
  const sun = useRef<Sprite>(null);
  const pixels = useMemo(() => sunPixels(), []);

  useFrame(({ camera }) => {
    if (!sun.current) return;
    // Follow camera translation, never its rotation: a distant sun has no visible parallax.
    const distance = camera.far * 0.88;
    sun.current.position.copy(camera.position).addScaledVector(SUN_DIRECTION, distance);
    const diameter = 2 * distance * Math.tan(HALO_DIAMETER / 2);
    sun.current.scale.set(diameter, diameter, 1);
  });

  return (
    <sprite ref={sun} renderOrder={-1}>
      <spriteMaterial transparent depthWrite={false} toneMapped={false} fog={false}>
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
