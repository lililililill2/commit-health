import { useQuery } from '@tanstack/react-query';

import { apiClient } from '@/shared/api';

export const mealLabels = {
  BREAKFAST: '아침',
  LUNCH: '점심',
  DINNER: '저녁',
  SNACK: '간식',
} as const;

export type MealKind = keyof typeof mealLabels;

export const mealKinds = Object.keys(mealLabels) as MealKind[];

export const sourceLabels = { CATALOG: '음식 검색', SCHOOL: '학교 급식', MANUAL: '직접 입력' };

interface PortionSnapshot {
  portions?: number;
  kcalPerPortion?: number | null;
  energyKcal?: number | null;
  servingSourceUrl?: string;
}

export type MealItem = { id: string; name: string } & (
  | ({
      source: 'CATALOG';
      foodId: string;
      kcal: number;
      basis: string;
      amount?: number | null;
      referenceType?: string;
    } & PortionSnapshot)
  | { source: 'SCHOOL'; schoolName: string; schoolMealKcal?: number | null }
  | ({ source: 'MANUAL' } & PortionSnapshot)
);

export interface MealRecord {
  id: string;
  date: string;
  kind: MealKind;
  revision: number;
  items: MealItem[];
}

export interface School {
  officeCode: string;
  schoolCode: string;
  name: string;
  region: string;
}

export interface SchoolMenu {
  kind: Exclude<MealKind, 'SNACK'>;
  items: string[];
  mealKcal: number | null;
}

export interface HistoryFood {
  name: string;
  foodId: string | null;
  count: number;
}

interface TodayProgress {
  recordDate: string;
  dayEndsAt: string;
  mealCount: number;
  mainMeals: number;
  dailyRecordCount: number;
}

export const mealsKey = (userId: string | undefined) => ['meals', userId] as const;

export function useTodayMealProgress(userId: string | undefined) {
  return useQuery({
    queryKey: [...mealsKey(userId), 'today-progress'],
    enabled: Boolean(userId),
    queryFn: async ({ signal }) =>
      (await apiClient.get<TodayProgress>('meals/today-progress', { signal })).data,
    staleTime: 0,
    retry: false,
    refetchInterval: ({ state }) => {
      if (!state.data) return false;
      const remaining = Date.parse(state.data.dayEndsAt) - Date.now();
      return remaining > 0 ? Math.max(100, remaining + 100) : 60_000;
    },
  });
}

export function useMeals(userId: string, date: string) {
  return useQuery({
    queryKey: [...mealsKey(userId), 'day', date],
    queryFn: async ({ signal }) =>
      (await apiClient.get<MealRecord[]>('meals', { signal, params: { date } })).data,
  });
}

export function useMealHistory(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: [...mealsKey(userId), 'history'],
    enabled,
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<{ recent: HistoryFood[]; frequent: HistoryFood[] }>('meals/history', {
          signal,
        })
      ).data,
  });
}

export function useSchool(userId: string) {
  return useQuery({
    queryKey: [...mealsKey(userId), 'school'],
    queryFn: async ({ signal }) =>
      (await apiClient.get<{ school: School | null }>('meals/school', { signal })).data.school,
    retry: false,
  });
}

export function useSchoolMenus(userId: string, date: string, school: School | null | undefined) {
  return useQuery({
    queryKey: [...mealsKey(userId), 'menus', school?.officeCode, school?.schoolCode, date],
    enabled: Boolean(school),
    queryFn: async ({ signal }) =>
      (
        await apiClient.get<{ school: School | null; meals: SchoolMenu[] }>('meals/school/menus', {
          signal,
          params: { date },
        })
      ).data,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useSchoolSearch(userId: string, query: string) {
  return useQuery({
    queryKey: [...mealsKey(userId), 'schools', query],
    enabled: query.length >= 2,
    queryFn: async ({ signal }) =>
      (await apiClient.get<School[]>('meals/schools', { signal, params: { q: query } })).data,
    staleTime: 5 * 60_000,
    retry: false,
  });
}
