'use client';

import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
  UVMapping,
  type Fog,
  type Vector3,
} from 'three';

import {
  BACKDROP_COLOR,
  BACKDROP_TEXTURE_URL,
  CAMPUS_BUILDINGS,
  CAMPUS_TREES,
  backdropFog,
  backdropFrame,
} from '../model/backdrop-config';
import { CampusClouds } from './campus-clouds';
import { CampusBench, CampusBuilding, CampusTree, SceneryGroup } from './campus-scenery';
import { CampusSun } from './campus-sun';

function PavedPath({
  x = 0,
  z = 0,
  y,
  width,
  length,
}: {
  x?: number;
  z?: number;
  y: number;
  width: number;
  length: number;
}) {
  const source = useTexture(BACKDROP_TEXTURE_URL);
  const anisotropy = useThree((state) =>
    Math.max(1, Math.min(8, state.gl.capabilities.getMaxAnisotropy())),
  );
  return (
    <mesh position={[x, y, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, length]} />
      <meshStandardMaterial roughness={1} metalness={0}>
        <texture
          attach="map"
          args={[
            source.image,
            UVMapping,
            RepeatWrapping,
            RepeatWrapping,
            LinearFilter,
            LinearMipmapLinearFilter,
            RGBAFormat,
            UnsignedByteType,
            anisotropy,
          ]}
          colorSpace={SRGBColorSpace}
          repeat={[width / 2.8, length / 2.8]}
          needsUpdate
        />
      </meshStandardMaterial>
    </mesh>
  );
}

export function DormBackdrop({
  size,
  maxDistance,
  animate,
}: {
  size: Vector3;
  maxDistance: number;
  animate: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const fog = useRef<Fog>(null);
  const lastDistance = useRef(-1);
  const frame = backdropFrame(size, maxDistance);
  const fade = backdropFog(camera.position.length(), frame.radius);
  const courtWidth = size.x + 3.6;
  const courtLength = size.z + 3.6;
  const pathY = frame.floorY + 0.02;

  useFrame(({ camera }) => {
    const distance = camera.position.length();
    if (Math.abs(distance - lastDistance.current) < 0.001) return;
    lastDistance.current = distance;
    const fade = backdropFog(distance, frame.radius);
    if (fog.current) {
      fog.current.near = fade.near;
      fog.current.far = fade.far;
    }
  });

  return (
    <>
      <fog ref={fog} attach="fog" args={[BACKDROP_COLOR, fade.near, fade.far]} />
      <CampusSun />
      <CampusClouds />
      <mesh position={[0, frame.floorY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[frame.extent, frame.extent]} />
        <meshStandardMaterial color="#c2d1a8" roughness={1} />
      </mesh>
      <PavedPath y={pathY} width={courtWidth} length={courtLength} />
      <PavedPath y={pathY} z={(courtLength + 60) / 2} width={3.8} length={60} />
      <PavedPath y={pathY} z={-(courtLength + 40) / 2} width={3.8} length={40} />
      <PavedPath y={pathY + 0.002} z={-12} width={56} length={3.6} />
      {/* A quiet contact shadow anchors the untouched GLB to the courtyard. */}
      <mesh position={[-0.25, pathY + 0.005, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[size.x + 0.8, size.z + 0.7]} />
        <meshBasicMaterial color="#7c806b" transparent opacity={0.12} depthWrite={false} />
      </mesh>
      {CAMPUS_BUILDINGS.map((building) => (
        <SceneryGroup key={building.x} x={building.x} z={building.z} floorY={pathY}>
          <CampusBuilding {...building} />
        </SceneryGroup>
      ))}
      {CAMPUS_TREES.map((tree, index) => (
        <SceneryGroup key={tree.x} x={tree.x} z={tree.z} floorY={frame.floorY}>
          <CampusTree scale={tree.scale} phase={index * 1.7} animate={animate} />
        </SceneryGroup>
      ))}
      {[-9, 9].map((x) => (
        <SceneryGroup key={x} x={x} z={-9} floorY={pathY}>
          <CampusBench />
        </SceneryGroup>
      ))}
    </>
  );
}
