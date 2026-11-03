'use client';

import { OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { PerspectiveCamera } from 'three';

import { BACKDROP_COLOR } from '../model/backdrop-config';
import { createOrbitActivity } from '../model/orbit-activity';
import { useBackdropMotion } from '../model/use-backdrop-motion';
import {
  FIELD_OF_VIEW,
  MAX_AZIMUTH_ANGLE,
  MAX_POLAR_ANGLE,
  MIN_AZIMUTH_ANGLE,
  MIN_POLAR_ANGLE,
  MODEL_URL,
  ORBIT_MOTION,
  cameraFrame,
  frameCamera,
  prepareDormModel,
} from '../model/view-config';
import { DormBackdrop } from './dorm-backdrop';
import { ViewerStatus } from './viewer-status';
import styles from './dorm-viewer.module.css';

function ContextGuard() {
  const gl = useThree((state) => state.gl);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      setLost(true);
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [gl]);
  if (lost) throw new Error('The WebGL context was lost');
  return null;
}

function DormModel({
  onReady,
  animate,
  onInteractionChange,
}: {
  onReady: () => void;
  animate: boolean;
  onInteractionChange?: (active: boolean) => void;
}) {
  // This GLB is self-contained and uncompressed; no external decoder/CDN is needed.
  const { scene } = useGLTF(MODEL_URL, false, false);
  const model = useMemo(() => prepareDormModel(scene), [scene]);
  const camera = useThree((state) => state.camera);
  const viewport = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const framed = useRef(false);
  const activity = useMemo(() => createOrbitActivity(onInteractionChange), [onInteractionChange]);
  const aspect = Math.max(viewport.width, 1) / Math.max(viewport.height, 1);
  const frame = useMemo(() => cameraFrame(model.size, aspect), [model.size, aspect]);

  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera)) return;
    frameCamera(camera, model.size, aspect, !framed.current);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    framed.current = true;
    invalidate();
  }, [camera, model.size, aspect, invalidate]);

  useEffect(() => {
    // The camera layout effect requests a render before dismissing the loading overlay.
    const id = requestAnimationFrame(onReady);
    return () => {
      cancelAnimationFrame(id);
      activity.dispose();
    };
  }, [onReady, model, activity]);

  return (
    <>
      <DormBackdrop size={model.size} maxDistance={frame.maxDistance} animate={animate} />
      <primitive object={model.root} dispose={null} />
      <OrbitControls
        ref={controls}
        makeDefault
        onStart={activity.start}
        onChange={activity.change}
        onEnd={activity.end}
        target={[0, 0, 0]}
        enablePan={false}
        {...ORBIT_MOTION}
        autoRotate={false}
        minPolarAngle={MIN_POLAR_ANGLE}
        maxPolarAngle={MAX_POLAR_ANGLE}
        minAzimuthAngle={MIN_AZIMUTH_ANGLE}
        maxAzimuthAngle={MAX_AZIMUTH_ANGLE}
        minDistance={frame.minDistance}
        maxDistance={frame.maxDistance}
      />
    </>
  );
}

export default function DormCanvas({
  onReady,
  onInteractionChange,
}: {
  onReady: () => void;
  onInteractionChange?: (active: boolean) => void;
}) {
  const animate = useBackdropMotion();
  return (
    <Canvas
      className={styles.canvas}
      camera={{ fov: FIELD_OF_VIEW, position: [0, 0, 1] }}
      frameloop={animate ? 'always' : 'demand'}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      fallback={<ViewerStatus kind="unsupported" />}
      aria-label="드래그로 회전할 수 있는 기숙사 3D 모델"
    >
      <color attach="background" args={[BACKDROP_COLOR]} />
      <ambientLight intensity={0.35} />
      <ContextGuard />
      <Suspense fallback={null}>
        <DormModel onReady={onReady} animate={animate} onInteractionChange={onInteractionChange} />
      </Suspense>
    </Canvas>
  );
}
