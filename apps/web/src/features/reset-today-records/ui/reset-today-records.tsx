'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { activityQueryKey } from '@/entities/activity';
import { caffeineQueryKey } from '@/entities/caffeine';
import { mealsKey } from '@/entities/meal';
import { getSession, useSession } from '@/entities/session';
import { sleepQueryKey } from '@/entities/sleep';
import { apiClient } from '@/shared/api';

const koreanDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });

export function ResetTodayRecords() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const reset = useMutation({
    mutationFn: async ({ userId, recordDate }: { userId: string; recordDate: string }) => {
      const current = await getSession();
      if (!current || current.user.id !== userId) throw new Error('Session changed');
      await apiClient.delete(`dev/records/today/${recordDate}`, {
        headers: { 'X-CSRF-Token': current.csrfToken },
      });
    },
    onSuccess: async (_, { userId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: sleepQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: activityQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: caffeineQueryKey(userId) }),
        queryClient.invalidateQueries({ queryKey: mealsKey(userId) }),
      ]);
    },
  });

  function confirmReset() {
    if (!session || reset.isPending) return;
    const recordDate = koreanDate.format(new Date());
    if (!window.confirm(`${recordDate}의 수면·카페인·식사·컨디션·명상·스트레칭 기록을 삭제할까요?`))
      return;
    reset.mutate({ userId: session.user.id, recordDate });
  }

  return (
    <section
      aria-labelledby="dev-records-heading"
      className="mt-8 space-y-3 border-t border-white/15 pt-6"
    >
      <h2 id="dev-records-heading" className="text-sm font-medium text-white/70">
        개발자 기능
      </h2>
      <button
        type="button"
        onClick={confirmReset}
        disabled={!session || reset.isPending}
        className="min-h-12 w-full rounded-lg border border-red-400/50 px-5 py-3 text-sm font-medium text-red-300 hover:bg-red-400/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-300 disabled:opacity-50"
      >
        {reset.isPending ? '초기화 중…' : '오늘 기록 초기화'}
      </button>
      {reset.isSuccess && (
        <p role="status" className="text-sm text-emerald-300">
          오늘 기록을 초기화했어요.
        </p>
      )}
      {reset.isError && (
        <p role="alert" className="text-sm text-red-300">
          {isAxiosError(reset.error) && reset.error.response?.status === 409
            ? '날짜가 바뀌었어요. 다시 확인해 주세요.'
            : '오늘 기록을 초기화하지 못했어요.'}
        </p>
      )}
    </section>
  );
}
