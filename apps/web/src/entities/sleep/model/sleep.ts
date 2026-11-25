'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

export interface SleepRecord {
  id: string;
  recordDate: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  createdAt: string;
}

export interface SleepDay {
  recordDate: string;
  dayEndsAt: string;
  record: SleepRecord | null;
}

export const sleepQueryKey = (userId: string | undefined) => ['sleep', 'today', userId] as const;

export function useTodaySleep(userId: string | undefined) {
  return useQuery({
    queryKey: sleepQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<SleepDay>('sleep/today', { signal });
      return data;
    },
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const end = query.state.data?.dayEndsAt;
      return end ? Math.max(1_000, Math.min(60_000, Date.parse(end) - Date.now() + 100)) : false;
    },
  });
}
