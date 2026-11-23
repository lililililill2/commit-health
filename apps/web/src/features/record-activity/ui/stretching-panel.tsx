'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';

import { cn } from '@/shared/lib';
import { stretchExercises, type StretchExercise } from '../model/stretch-config';
import { DIRECTION_MS } from '../model/stretch-progress';
import { useStretching } from '../model/use-stretching';

const panel = 'rounded-xl border border-white/20 bg-white/5 p-5 sm:p-6';
const button =
  'inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-white/25 px-4 py-2 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300 disabled:cursor-default disabled:opacity-50';

function StretchExercisePanel({ exercise }: { exercise: StretchExercise }) {
  const video = useRef<HTMLVideoElement>(null);
  const { status, progress, message, start, retry, stop } = useStretching();
  const usingCamera = status === 'loading' || status === 'running';
  const direction = progress?.direction ?? 'left';
  const elapsed = (direction === 'left' ? progress?.leftMs : progress?.rightMs) ?? 0;
  const confidence = Math.floor((progress?.confidence ?? 0) * 1_000) / 10;
  const guidance =
    progress?.signal === 'paused'
      ? '카메라 연결이나 탭 상태를 확인해 주세요. 영상이 돌아오면 이어서 진행해요.'
      : progress?.signal === 'no-person'
        ? '카메라 안에 얼굴과 양쪽 어깨가 보이도록 맞춰 주세요.'
        : progress?.signal === 'counting'
          ? '지금 자세를 유지해 주세요.'
          : progress?.signal === 'stabilizing'
            ? '자세를 확인하고 있어요.'
            : progress?.signal === 'switch'
              ? '왼쪽 완료. 이제 오른쪽으로 바꿔 주세요.'
              : exercise.guidance[direction];

  if (status === 'complete') {
    return (
      <section className={cn(panel, 'space-y-4')} aria-labelledby="stretch-complete-title">
        <p role="status" className="text-sm text-emerald-300">
          ✓ 오늘의 기록에 저장했어요.
        </p>
        <h2 id="stretch-complete-title" className="text-xl font-medium">
          스트레칭 완료
        </h2>
        <p className="text-sm text-white/75">{exercise.title} · 왼쪽 10초 · 오른쪽 10초</p>
        <Link href="/" className={button}>
          대시보드로 돌아가기
        </Link>
      </section>
    );
  }

  return (
    <section className={cn(panel, 'space-y-4')} aria-labelledby="stretch-exercise-title">
      <h2 id="stretch-exercise-title" className="text-lg font-medium">
        {exercise.title}
      </h2>
      <p className="text-sm leading-6 text-white/70">{exercise.description}</p>
      <div
        className={cn(
          'gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
          usingCamera ? 'grid' : 'hidden',
        )}
      >
        <video
          ref={video}
          muted
          playsInline
          aria-label="카메라 미리보기"
          className={cn(
            'aspect-square w-full rounded-lg bg-black object-cover',
            exercise.flipInput && '-scale-x-100',
          )}
        />
        {status === 'running' && (
          <div className="space-y-4">
            <p role="status" className="text-sm text-sky-200">
              {direction === 'left' ? '왼쪽 진행 중' : '왼쪽 완료 · 오른쪽 진행 중'}
            </p>
            <div className="space-y-2">
              <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span>
                  남은 시간{' '}
                  <span className="font-medium tabular-nums">
                    {Math.ceil((DIRECTION_MS - elapsed) / 1_000)}초
                  </span>
                </span>
                <span className="text-white/70 tabular-nums">인식 확률 {confidence}%</span>
              </p>
              <progress
                aria-label={`${direction === 'left' ? '왼쪽' : '오른쪽'} 자세 진행도`}
                value={elapsed}
                max={DIRECTION_MS}
                className="block h-3 w-full accent-sky-300"
              />
            </div>
            <p className="text-sm leading-6 text-white/80">{guidance}</p>
            <p className="text-xs leading-5 text-white/60">
              인식 확률이 90% 이상일 때만 시간이 쌓여요.
            </p>
          </div>
        )}
      </div>
      {status === 'loading' && (
        <p role="status" className="text-sm text-white/70">
          카메라와 자세 인식 모델을 준비하는 중…
        </p>
      )}
      {status === 'saving' && (
        <p role="status" className="text-sm">
          양쪽 자세 완료 · 기록 저장 중…
        </p>
      )}
      {message && (
        <p role="alert" className="text-sm text-red-300">
          {message}
        </p>
      )}
      {(status === 'idle' || status === 'error') && (
        <>
          <p className="text-sm text-white/60">영상은 기기에서만 분석해요.</p>
          <button
            type="button"
            className={cn(button, 'border-sky-300/60 text-sky-100')}
            onClick={() => {
              if (video.current) void start(exercise, video.current);
            }}
          >
            {status === 'error' ? '카메라 다시 시작' : '카메라로 시작하기'}
          </button>
        </>
      )}
      {usingCamera && (
        <button type="button" className={button} onClick={stop}>
          스트레칭 종료
        </button>
      )}
      {status === 'retry' && (
        <button type="button" className={button} onClick={() => void retry()}>
          다시 저장
        </button>
      )}
    </section>
  );
}

export function StretchingPanel() {
  const [selected, setSelected] = useState<StretchExercise>();
  if (selected)
    return (
      <div className="mt-8 max-w-3xl">
        <StretchExercisePanel exercise={selected} />
      </div>
    );
  return (
    <section className="mt-8 max-w-3xl space-y-4" aria-labelledby="stretch-selection-title">
      <h2 id="stretch-selection-title" className="text-lg font-medium">
        스트레칭 종류 선택
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {stretchExercises.map((exercise) => (
          <li key={exercise.kind}>
            <button
              type="button"
              className={cn(
                panel,
                'flex w-full cursor-pointer items-center justify-between gap-3 text-left hover:border-sky-300/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-300',
              )}
              onClick={() => setSelected(exercise)}
            >
              <span>{exercise.title}</span>
              <span aria-hidden="true" className="text-white/50">
                →
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
