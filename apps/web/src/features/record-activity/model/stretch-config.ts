export interface PoseLabels {
  left: string;
  right: string;
  neutral: string;
}

export class StretchCameraError extends Error {}

const defaultModelUrl = 'https://teachablemachine.withgoogle.com/models/l8ZWiP8SW/';
const modelUrl = process.env.NEXT_PUBLIC_STRETCH_POSE_MODEL_URL || defaultModelUrl;
const usesDefaultModel = modelUrl.replace(/\/$/, '') === defaultModelUrl.slice(0, -1);

export const stretchExercises = [
  {
    kind: 'shoulder-cross-body',
    title: '어깨 가로 스트레칭',
    description: '한쪽 팔을 가슴 앞으로 가볍게 뻗고 반대쪽 팔로 받쳐 주세요. 왼팔부터 시작해요.',
    guidance: {
      left: '왼팔을 가슴 앞으로 뻗고 오른팔로 가볍게 받쳐 주세요.',
      right: '오른팔을 가슴 앞으로 뻗고 왼팔로 가볍게 받쳐 주세요.',
    },
    modelUrl,
    labels: {
      left: process.env.NEXT_PUBLIC_STRETCH_POSE_LEFT_LABEL ?? (usesDefaultModel ? 'left' : ''),
      right: process.env.NEXT_PUBLIC_STRETCH_POSE_RIGHT_LABEL ?? (usesDefaultModel ? 'right' : ''),
      neutral:
        process.env.NEXT_PUBLIC_STRETCH_POSE_NEUTRAL_LABEL ?? (usesDefaultModel ? 'default' : ''),
    },
    flipInput: process.env.NEXT_PUBLIC_STRETCH_POSE_FLIP_INPUT !== 'false',
  },
] as const;

export type StretchExercise = (typeof stretchExercises)[number];

export function resolvePoseLabels(
  exercise: Pick<StretchExercise, 'modelUrl' | 'labels'>,
  metadataLabels: readonly unknown[],
): PoseLabels | null {
  const { labels } = exercise;
  const originalModel = exercise.modelUrl.replace(/\/$/, '') === defaultModelUrl.slice(0, -1);
  const neutral =
    originalModel && labels.neutral === 'default' && !metadataLabels.includes('default')
      ? 'defalt'
      : labels.neutral;
  const expected = [labels.left, labels.right, neutral];
  if (
    !expected.every((label) => label.trim() !== '' && metadataLabels.includes(label)) ||
    new Set(expected).size !== expected.length ||
    new Set(metadataLabels).size !== metadataLabels.length ||
    !metadataLabels.every((label) => typeof label === 'string' && label.trim() !== '')
  )
    return null;
  return { ...labels, neutral };
}
