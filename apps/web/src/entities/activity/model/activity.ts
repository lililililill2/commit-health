'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api';

export type ActivityKind = 'focus' | 'meditation';
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
  focus: { count: number; seconds: number };
  meditation: { count: number; seconds: number };
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
    refetchInterval: (query) => {
      const data = query.state.data;
      return data
        ? Math.max(
            1_000,
            Math.min(
              data.activeSession ? 4_000 : 60_000,
              Date.parse(data.dayEndsAt) - Date.now() + 100,
            ),
          )
        : false;
    },
  });
}
