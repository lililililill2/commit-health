'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useSession } from '@/entities/session';
import {
  activityQueryKey,
  formatActivityDuration,
  timerDigits,
  useTodayActivity,
} from '@/entities/activity';
import { createActivityTimer } from '../model/activity-timer';
import { activityError, activityTimerApi } from '../model/activity-api';
import { browserTimerEnvironment } from '../model/browser-timer-environment';

const buttonClass =
  'min-h-11 rounded-lg border border-white/30 px-5 py-2.5 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff] disabled:cursor-not-allowed disabled:opacity-50';

export function ActivityTimer() {
  const session = useSession(),
    userId = session.data?.user.id;
  const queryClient = useQueryClient(),
    today = useTodayActivity(userId);
  const timer = useMemo(
    () =>
      createActivityTimer({
        api: activityTimerApi(userId, 'focus'),
        environment: browserTimerEnvironment,
        onResult: () => {
          void queryClient.invalidateQueries({ queryKey: activityQueryKey(userId) });
        },
        describeError: activityError,
      }),
    [userId, queryClient],
  );
  const state = useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
  useEffect(() => () => timer.dispose(), [timer]);
  const active = ['starting', 'running', 'saving'].includes(state.phase);
  const total = today.data?.focus;

  return (
    <section className="mt-8 max-w-xl space-y-6 rounded-xl border border-white/20 bg-white/5 p-6">
      <p className="text-sm leading-6 text-white/65">
        시작을 누르고 집중한 뒤, 마치기를 눌러 시간을 기록하세요. 측정 중 다른 탭·창으로 전환하거나
        이 화면을 나가면 실패해요.
      </p>
      <p className="text-center text-4xl tabular-nums" aria-label="집중 시간">
        {timerDigits(state.seconds)}
      </p>
      {state.message && (
        <p
          role="status"
          className={
            state.phase === 'completed' ? 'text-sm text-emerald-300' : 'text-sm text-amber-200'
          }
        >
          {state.message}
        </p>
      )}
      {today.isError && !today.data && (
        <p role="alert" className="text-sm text-red-300">
          오늘 기록을 불러오지 못했어요.{' '}
          <button className="underline" onClick={() => void today.refetch()}>
            다시 시도
          </button>
        </p>
      )}
      {!active && today.data?.activeSession && (
        <p className="text-sm text-amber-200">
          진행 중이던 측정을 확인하고 있어요. 잠시 후 다시 시작해 주세요.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-3">
        {!active && (
          <button
            type="button"
            disabled={!today.data || Boolean(today.data.activeSession)}
            onClick={() => void timer.start()}
            className={buttonClass}
          >
            {state.phase === 'idle' ? '시작하기' : '다시 시작하기'}
          </button>
        )}
        {state.phase === 'running' && (
          <button
            type="button"
            disabled={state.seconds < 1}
            onClick={() => void timer.complete()}
            className={buttonClass}
          >
            집중 마치기
          </button>
        )}
        {['starting', 'running'].includes(state.phase) && (
          <button type="button" onClick={timer.cancel} className={buttonClass}>
            중단하기
          </button>
        )}
        {state.phase === 'saving' && (
          <p role="status" className="text-sm">
            기록 저장 중…
          </p>
        )}
      </div>
      {total && (
        <p className="text-sm text-white/60">
          오늘 성공 {total.count}회 · {formatActivityDuration(total.seconds)}
        </p>
      )}
      {state.phase === 'completed' && (
        <Link
          href="/commit"
          className="inline-flex min-h-11 items-center text-sm text-[#7db8ff] underline"
        >
          커밋하기 목록으로
        </Link>
      )}
    </section>
  );
}
