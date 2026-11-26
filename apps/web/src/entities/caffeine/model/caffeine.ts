'use client';

import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';
import { refetchUntilDayEnds } from '@/shared/lib';

export interface CaffeineProduct {
  id: string;
  brand: string;
  name: string;
  servingLabel: string;
  caffeineMg: number;
  sourceUrl: string;
}

export interface CaffeineRecord {
  id: string;
  catalogId: string | null;
  drinkName: string;
  servingLabel: string | null;
  caffeineMg: number;
  consumedAt: string;
}

export interface CaffeineDay {
  recordDate: string;
  dayEndsAt: string;
  totalMg: number;
  records: CaffeineRecord[];
  caffeineFree: boolean;
}

export const caffeineQueryKey = (userId: string | undefined) =>
  ['caffeine', 'today', userId] as const;

const amount = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });

export function formatCaffeineMg(mg: number) {
  return `${amount.format(mg)} mg`;
}

export function useTodayCaffeine(userId: string | undefined) {
  return useQuery({
    queryKey: caffeineQueryKey(userId),
    enabled: Boolean(userId),
    queryFn: async ({ signal }) =>
      (await apiClient.get<CaffeineDay>('caffeine/today', { signal })).data,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => refetchUntilDayEnds(query.state.data?.dayEndsAt),
  });
}

export function useCaffeineCatalog(userId: string) {
  return useQuery({
    queryKey: ['caffeine', 'catalog', userId],
    queryFn: async ({ signal }) =>
      (await apiClient.get<CaffeineProduct[]>('caffeine/catalog', { signal })).data,
    staleTime: 300_000,
    retry: false,
  });
}
