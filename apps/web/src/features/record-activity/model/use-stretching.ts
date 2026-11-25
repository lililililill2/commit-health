'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { activityQueryKey } from '@/entities/activity';
import { sessionQueryKey, useSession } from '@/entities/session';
import { activityError, activityTimerApi } from './activity-api';
import { StretchCameraError, type StretchExercise } from './stretch-config';
import type { StretchProgress } from './stretch-progress';

type Status = 'idle' | 'loading' | 'running' | 'saving' | 'retry' | 'complete' | 'error';
type Pending = {
  id: string;
  api: ReturnType<typeof activityTimerApi>;
  progress: StretchProgress;
};

function errorMessage(error: unknown, stage: 'loading' | 'api' | 'tracking') {
  if (
    (isAxiosError(error) && error.response?.status === 401) ||
    (error instanceof Error && error.message === 'Session changed')
  )
    return '로그인이 만료됐어요. 다시 로그인해 주세요.';
  if (stage === 'api') {
    if (isAxiosError(error) && error.response?.status === 400) {
      const messages: unknown = error.response.data?.message;
      if (
        Array.isArray(messages) &&
        messages.includes('kind must be one of the following values: focus, meditation')
      )
        return '연결된 서버에 스트레칭 기능이 반영되지 않았어요. 최신 백엔드를 실행해 주세요.';
    }
    return activityError(error);
  }
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      return '카메라 권한이 차단됐어요. 브라우저에서 권한을 허용한 뒤 다시 시작해 주세요.';
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
      return '사용할 수 있는 카메라를 찾지 못했어요.';
    if (error.name === 'NotReadableError')
      return '카메라를 열 수 없어요. 다른 앱에서 카메라를 사용 중인지 확인해 주세요.';
  }
  if (error instanceof StretchCameraError) return error.message;
  return stage === 'tracking'
    ? '자세 인식을 멈췄어요. 카메라 연결을 확인하고 다시 시작해 주세요.'
    : '모델이나 카메라를 준비하지 못했어요. 연결을 확인하고 다시 시작해 주세요.';
}

export function useStretching() {
  const userId = useSession().data?.user.id;
  const queries = useQueryClient();
  const active = useRef<AbortController | null>(null);
  const pending = useRef<Pending | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<StretchProgress>();

  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  function invalidate(error?: unknown) {
    void queries.invalidateQueries({ queryKey: activityQueryKey(userId) });
    if (
      (isAxiosError(error) && error.response?.status === 401) ||
      (error instanceof Error && error.message === 'Session changed')
    ) {
      void queries.invalidateQueries({ queryKey: sessionQueryKey });
    }
  }

  async function save(record: Pending, run: AbortController) {
    if (run.signal.aborted) return;
    setStatus('saving');
    setMessage('');
    try {
      const { leftMs, rightMs } = record.progress;
      await record.api.complete(record.id, { leftMs, rightMs });
      pending.current = null;
      invalidate();
      if (!run.signal.aborted) setStatus('complete');
    } catch (error) {
      invalidate(error);
      if (run.signal.aborted) return;
      const rejected =
        isAxiosError(error) && [400, 401, 403, 404, 409].includes(error.response?.status ?? 0);
      if (rejected) {
        pending.current = null;
        void record.api.fail(record.id).catch(() => {});
      }
      setMessage(errorMessage(error, 'api'));
      setStatus(rejected ? 'error' : 'retry');
    }
  }

  async function start(exercise: StretchExercise, video: HTMLVideoElement) {
    if (!userId || active.current || pending.current) return;
    const run = new AbortController();
    active.current = run;
    const api = activityTimerApi(userId, exercise.kind);
    let sessionId: string | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let heartbeatBusy = false;
    let serverError: unknown;
    let reachedResult = false;
    let stage: 'loading' | 'api' | 'tracking' = 'loading';
    setMessage('');
    setProgress(undefined);
    setStatus('loading');
    try {
      const { runStretchCamera } = await import('./stretch-camera');
      run.signal.throwIfAborted();
      const result = await runStretchCamera({
        exercise,
        video,
        signal: run.signal,
        onReady: async () => {
          stage = 'api';
          const { id } = await api.start();
          sessionId = id;
          run.signal.throwIfAborted();
          stage = 'tracking';
          setStatus('running');
          heartbeat = setInterval(() => {
            if (heartbeatBusy || run.signal.aborted) return;
            heartbeatBusy = true;
            void api
              .heartbeat(id)
              .catch((error: unknown) => {
                if (reachedResult || run.signal.aborted) return;
                serverError = error;
                run.abort();
              })
              .finally(() => {
                heartbeatBusy = false;
              });
          }, 4_000);
        },
        onProgress: (value) => {
          if (!run.signal.aborted) setProgress(value);
        },
      });
      reachedResult = true;
      clearInterval(heartbeat);
      if (sessionId && !run.signal.aborted) {
        const record = { id: sessionId, api, progress: result };
        pending.current = record;
        await save(record, run);
      }
    } catch (error) {
      if (active.current === run) {
        const failure = serverError ?? error;
        invalidate(failure);
        const canceled = run.signal.aborted && serverError === undefined;
        setMessage(canceled ? '' : errorMessage(failure, serverError ? 'api' : stage));
        setStatus(canceled ? 'idle' : 'error');
      }
    } finally {
      clearInterval(heartbeat);
      if (!reachedResult && sessionId)
        void api
          .fail(sessionId)
          .catch(() => {})
          .finally(() => invalidate());
      if (active.current === run) active.current = null;
    }
  }

  async function retry() {
    if (!pending.current || active.current) return;
    const run = new AbortController();
    active.current = run;
    try {
      await save(pending.current, run);
    } finally {
      if (active.current === run) active.current = null;
    }
  }

  return { status, progress, message, start, retry, stop: () => active.current?.abort() };
}
