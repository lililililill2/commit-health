'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api';
import { refetchUntilDayEnds } from '@/shared/lib';

export type ActivityKind = 'meditation' | 'shoulder-cross-body';
export interface ActivitySession {
  id: string;
  kind: ActivityKind;
  status: string;
  startedAt: string;
  durationSeconds: number;
}
export interface ActivityDay {
  recordDate: string;
  dayEndsAt: string;
  condition: { score: number; updatedAt: string } | null;
  meditation: { count: number; seconds: number };
  stretching: { count: number; seconds: number };
  activeSession: ActivitySession | null;
}
export const activityQueryKey = (userId: string | undefined) =>
  ['activity', 'today', userId] as const;
export function useTodayActivity(userId: string | undefined) {
  return useQuery({
    queryKey: activityQueryKey(userId),
    enabled: Boolean(userId),
    staleTime: 0,
    retry: false,
    queryFn: async ({ signal }) =>
      (await apiClient.get<ActivityDay>('activity/today', { signal })).data,
    refetchInterval: ({ state: { data } }) =>
      refetchUntilDayEnds(data?.dayEndsAt, data?.activeSession ? 4_000 : 60_000),
  });
}
