export const POSE_THRESHOLD = 0.9;
export const DIRECTION_MS = 10_000;
export const STABLE_MS = 200;
export const MAX_FRAME_GAP_MS = 500;

export type StretchDirection = 'left' | 'right';
type PoseLabel = StretchDirection | 'neutral' | 'other';

export interface PoseObservation {
  label: PoseLabel;
  confidence: Record<StretchDirection, number>;
}

export interface StretchProgress {
  direction: StretchDirection;
  leftMs: number;
  rightMs: number;
  complete: boolean;
  confidence: number;
  signal: 'switch' | 'no-person' | 'adjust' | 'counting' | 'stabilizing' | 'paused';
}

export function createStretchProgress() {
  let direction: StretchDirection = 'left';
  let leftMs = 0;
  let rightMs = 0;
  let previousAt: number | undefined;
  let stableSince: number | undefined;

  function pause() {
    previousAt = undefined;
    stableSince = undefined;
  }

  return {
    pause,
    sample(at: number, observation: PoseObservation | null): StretchProgress {
      const observedDirection = direction;
      const complete = () => rightMs === DIRECTION_MS;
      const confidence = observation?.confidence[direction] ?? 0;
      const matches = observation?.label === direction && confidence >= POSE_THRESHOLD;
      if (!matches || complete()) {
        pause();
      } else {
        const gap = previousAt === undefined ? 0 : at - previousAt;
        if (gap <= 0 || gap > MAX_FRAME_GAP_MS || stableSince === undefined) {
          stableSince = at;
        } else if (previousAt !== undefined && previousAt - stableSince >= STABLE_MS) {
          if (direction === 'left') leftMs = Math.min(DIRECTION_MS, leftMs + gap);
          else rightMs = Math.min(DIRECTION_MS, rightMs + gap);
        }
        previousAt = at;
        if (direction === 'left' && leftMs === DIRECTION_MS) {
          direction = 'right';
          pause();
        }
      }
      return {
        direction,
        leftMs,
        rightMs,
        complete: complete(),
        confidence: observedDirection === direction ? confidence : 0,
        signal:
          observedDirection !== direction
            ? ('switch' as const)
            : observation === null
              ? ('no-person' as const)
              : !matches
                ? ('adjust' as const)
                : stableSince !== undefined && at - stableSince >= STABLE_MS
                  ? ('counting' as const)
                  : ('stabilizing' as const),
      };
    },
  };
}
