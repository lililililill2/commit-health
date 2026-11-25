'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useSession } from '@/entities/session';
import { activityQueryKey, useTodayActivity, type ActivityDay } from '@/entities/activity';
import { apiClient } from '@/shared/api';
import { activityError, activityHeaders } from '../model/activity-api';

function ConditionEditor({ day, userId }: { day: ActivityDay; userId: string | undefined }) {
  const [score, setScore] = useState(day.condition?.score ?? 50);
  const queryClient = useQueryClient(),
    router = useRouter();
  const save = useMutation({
    mutationFn: async () =>
      (
        await apiClient.put<ActivityDay>(
          'activity/condition',
          { recordDate: day.recordDate, score },
          { headers: await activityHeaders(userId) },
        )
      ).data,
    onSuccess: async (data) => {
      const queryKey = activityQueryKey(userId);
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, data);
      router.replace('/commit');
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: activityQueryKey(userId) });
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    save.mutate();
  }
  return (
    <form onSubmit={submit} className="space-y-6">
      <p className="text-sm text-white/60">{day.recordDate} · 한국 시간</p>
      <label htmlFor="condition-score" className="block text-sm">
        오늘 하루의 전체적인 컨디션
      </label>
      <output htmlFor="condition-score" className="block text-center text-5xl tabular-nums">
        {score}
        <span className="ml-2 text-base text-white/50">/ 100</span>
      </output>
      <input
        id="condition-score"
        type="range"
        min={0}
        max={100}
        step={1}
        value={score}
        onChange={(event) => setScore(Number(event.target.value))}
        disabled={save.isPending}
        className="min-h-11 w-full cursor-pointer accent-sky-300"
      />
      <div className="flex justify-between text-xs text-white/60">
        <span>0 · 매우 낮음</span>
        <span>100 · 매우 좋음</span>
      </div>
      <p className="text-sm text-white/60">
        오늘은 언제든 수정할 수 있어요. 자정이 지나면 이전 날짜의 기록은 수정할 수 없어요.
      </p>
      {save.isError && (
        <p role="alert" className="text-sm text-red-300">
          {activityError(save.error)}
        </p>
      )}
      <button
        type="submit"
        disabled={save.isPending}
        className="min-h-11 rounded-lg border border-white/30 px-5 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50"
      >
        {save.isPending ? '저장 중…' : day.condition ? '수정사항 저장하기' : '저장하기'}
      </button>
    </form>
  );
}
export function ConditionForm() {
  const session = useSession(),
    userId = session.data?.user.id,
    today = useTodayActivity(userId);
  if (today.isPending)
    return (
      <p role="status" className="mt-8 text-sm text-white/60">
        오늘 기록을 불러오는 중…
      </p>
    );
  if (!today.data)
    return (
      <p role="alert" className="mt-8 text-sm">
        기록을 불러오지 못했어요.{' '}
        <button type="button" className="underline" onClick={() => void today.refetch()}>
          다시 시도
        </button>
      </p>
    );
  return (
    <section className="mt-8 max-w-xl rounded-xl border border-white/20 bg-white/5 p-6">
      <ConditionEditor key={today.data.recordDate} day={today.data} userId={userId} />
    </section>
  );
}
