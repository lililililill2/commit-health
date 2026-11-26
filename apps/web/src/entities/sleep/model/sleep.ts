'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';
import { refetchUntilDayEnds } from '@/shared/lib';

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
    refetchInterval: (query) => refetchUntilDayEnds(query.state.data?.dayEndsAt),
  });
}
