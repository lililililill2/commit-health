import type { CustomPoseNet, Metadata } from '@teachablemachine/pose';

import {
  resolvePoseLabels,
  StretchCameraError,
  type PoseLabels,
  type StretchExercise,
} from './stretch-config';
import { createStretchProgress, MAX_FRAME_GAP_MS, type StretchProgress } from './stretch-progress';

const MODEL_TIMEOUT = 45_000;
const CAMERA_TIMEOUT = 30_000;
const SAMPLE_INTERVAL = 90;

function waitForResource<T>(
  task: Promise<T>,
  signal: AbortSignal,
  timeout: number,
  message: string,
  release?: (resource: T) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let abandoned = false;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abandon = (reason: unknown) => {
      abandoned = true;
      cleanup();
      reject(reason);
    };
    const abort = () => abandon(signal.reason);
    const timer = setTimeout(() => abandon(new StretchCameraError(message)), timeout);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void task.then(
      (resource) => {
        cleanup();
        if (abandoned) release?.(resource);
        else resolve(resource);
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop();
}

interface LoadedModel {
  model: CustomPoseNet;
  labels: PoseLabels;
}

function disposeModel({ model }: LoadedModel) {
  model.dispose();
  model.model.dispose();
}

async function loadModel(exercise: StretchExercise, signal: AbortSignal) {
  const base = new URL(exercise.modelUrl.replace(/\/?$/, '/'));
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash)
    throw new StretchCameraError('HTTPS 모델 주소 설정을 확인해 주세요.');
  const options = { signal, credentials: 'omit' } as const;
  const response = await fetch(new URL('metadata.json', base), options);
  if (!response.ok)
    throw new StretchCameraError('모델 정보를 불러오지 못했어요. 모델 공유 주소를 확인해 주세요.');
  const metadata: unknown = await response.json();
  const labels =
    metadata &&
    typeof metadata === 'object' &&
    'packageName' in metadata &&
    metadata.packageName === '@teachablemachine/pose' &&
    'labels' in metadata &&
    Array.isArray(metadata.labels)
      ? resolvePoseLabels(exercise, metadata.labels)
      : null;
  if (!labels) {
    throw new StretchCameraError('모델의 왼쪽·오른쪽·기본 자세 클래스 설정이 일치하지 않아요.');
  }
  const [{ CustomPoseNet, loadPoseNet }, tf] = await Promise.all([
    import('@teachablemachine/pose/dist/custom-posenet'),
    import('@tensorflow/tfjs'),
  ]);
  signal.throwIfAborted();
  // Load the two resources separately so an interrupted load can release whichever model is ready.
  const modelMetadata = metadata as Metadata;
  const poseNet = await waitForResource(
    loadPoseNet(modelMetadata.modelSettings),
    signal,
    MODEL_TIMEOUT,
    '자세 추적 모델 로딩 시간이 초과됐어요.',
    (net) => net.dispose(),
  );
  try {
    const classifier = await tf.loadLayersModel(new URL('model.json', base).href, {
      requestInit: options,
    });
    try {
      signal.throwIfAborted();
      const model = new CustomPoseNet(classifier, poseNet, modelMetadata);
      if (model.getTotalClasses() !== modelMetadata.labels.length) {
        throw new StretchCameraError('모델 출력과 클래스 개수가 일치하지 않아요.');
      }
      return { model, labels };
    } catch (error) {
      classifier.dispose();
      throw error;
    }
  } catch (error) {
    poseNet.dispose();
    throw error;
  }
}

function nextFrame(signal: AbortSignal): Promise<number> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const frame = requestAnimationFrame((at) => {
      signal.removeEventListener('abort', abort);
      resolve(at);
    });
    const abort = () => {
      cancelAnimationFrame(frame);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

async function trackStretch(
  { model, labels }: LoadedModel,
  video: HTMLVideoElement,
  track: MediaStreamTrack,
  exercise: StretchExercise,
  signal: AbortSignal,
  onProgress: (progress: StretchProgress) => void,
) {
  const timer = createStretchProgress();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 257;
  const context = canvas.getContext('2d');
  if (!context) throw new StretchCameraError('카메라 화면을 분석할 수 없어요.');
  if (exercise.flipInput) {
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
  }

  let revision = 0;
  let lastAt = -Infinity;
  let lastVideoTime = -1;
  let interrupted = false;
  function pause() {
    revision += 1;
    timer.pause();
    if (interrupted) return;
    interrupted = true;
    onProgress({ ...timer.sample(performance.now(), null), signal: 'paused' });
  }
  const events = new AbortController();
  const listen = { signal: events.signal };
  document.addEventListener('visibilitychange', pause, listen);
  window.addEventListener('blur', pause, listen);
  track.addEventListener('mute', pause, listen);
  video.addEventListener('waiting', pause, listen);
  video.addEventListener('pause', pause, listen);
  const usable = () =>
    !document.hidden &&
    document.hasFocus() &&
    !video.paused &&
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    !track.muted &&
    track.readyState === 'live';
  try {
    for (;;) {
      const at = await nextFrame(signal);
      if (track.readyState === 'ended')
        throw new StretchCameraError('카메라 연결이 끊겼어요. 다시 시작해 주세요.');
      if (!usable() || video.currentTime === lastVideoTime) {
        if (!usable() || at - lastAt > MAX_FRAME_GAP_MS) pause();
        continue;
      }
      if (at - lastAt < SAMPLE_INTERVAL) continue;
      lastAt = at;
      lastVideoTime = video.currentTime;
      interrupted = false;
      const frameRevision = revision;
      const side = Math.min(video.videoWidth, video.videoHeight);
      context.drawImage(
        video,
        (video.videoWidth - side) / 2,
        (video.videoHeight - side) / 2,
        side,
        side,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      const inference = async () => {
        const { pose, posenetOutput } = await model.estimatePose(canvas);
        if (
          !pose ||
          pose.score < 0.35 ||
          !['leftShoulder', 'rightShoulder'].every((name) =>
            pose.keypoints.some((point) => point.part === name && point.score >= 0.35),
          )
        )
          return null;
        return model.predict(posenetOutput);
      };
      const scores = await waitForResource(
        inference(),
        signal,
        8_000,
        '자세 인식이 응답하지 않아요. 다시 시작해 주세요.',
      );
      if (frameRevision !== revision || !usable() || performance.now() - at > MAX_FRAME_GAP_MS) {
        pause();
        continue;
      }
      const probability = (name: string) =>
        scores?.find((score) => score.className === name)?.probability ?? 0;
      const best = scores?.reduce<(typeof scores)[number] | undefined>(
        (top, score) => (!top || score.probability > top.probability ? score : top),
        undefined,
      );
      const { left, right, neutral } = labels;
      const progress = timer.sample(
        at,
        best
          ? {
              label:
                best.className === left
                  ? 'left'
                  : best.className === right
                    ? 'right'
                    : best.className === neutral
                      ? 'neutral'
                      : 'other',
              confidence: { left: probability(left), right: probability(right) },
            }
          : null,
      );
      onProgress(progress);
      if (progress.complete) return progress;
    }
  } finally {
    events.abort();
  }
}

export async function runStretchCamera({
  exercise,
  video,
  signal,
  onReady,
  onProgress,
}: {
  exercise: StretchExercise;
  video: HTMLVideoElement;
  signal: AbortSignal;
  onReady: () => Promise<void>;
  onProgress: (progress: StretchProgress) => void;
}) {
  if (!window.isSecureContext)
    throw new StretchCameraError('카메라를 사용하려면 HTTPS 또는 localhost에서 열어 주세요.');
  if (!navigator.mediaDevices?.getUserMedia)
    throw new StretchCameraError('이 브라우저에서는 카메라를 사용할 수 없어요.');
  let stream: MediaStream | undefined;
  let model: LoadedModel | undefined;
  const stop = () => {
    if (stream) stopStream(stream);
    if (video.srcObject === stream) video.srcObject = null;
  };
  signal.addEventListener('abort', stop, { once: true });
  try {
    stream = await waitForResource(
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      }),
      signal,
      CAMERA_TIMEOUT,
      '카메라 권한 응답이 없어요. 다시 시작해 주세요.',
      stopStream,
    );
    signal.throwIfAborted();
    video.srcObject = stream;
    await waitForResource(video.play(), signal, CAMERA_TIMEOUT, '카메라 화면을 시작하지 못했어요.');
    const loading = new AbortController();
    const loadSignal = AbortSignal.any([signal, loading.signal]);
    try {
      model = await waitForResource(
        loadModel(exercise, loadSignal),
        loadSignal,
        MODEL_TIMEOUT,
        '모델을 불러오지 못했어요. 연결 상태를 확인해 주세요.',
        disposeModel,
      );
    } finally {
      loading.abort();
    }
    await onReady();
    signal.throwIfAborted();
    const [track] = stream.getVideoTracks();
    if (!track) throw new StretchCameraError('사용할 수 있는 카메라가 없어요.');
    return await trackStretch(model, video, track, exercise, signal, onProgress);
  } finally {
    signal.removeEventListener('abort', stop);
    stop();
    if (model) disposeModel(model);
  }
}
