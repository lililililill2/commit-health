import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { mealsKey, type MealKind, type School } from '@/entities/meal';
import { csrfHeaders } from '@/entities/session';
import { apiClient } from '@/shared/api';

export type SchoolRef = Pick<School, 'officeCode' | 'schoolCode'>;
export type FoodInput = ({ savedId: string } | { foodId: string } | { name: string }) & {
  portions?: number;
  kcalPerPortion?: number | null;
};

type DayMealInput = {
  kind: MealKind;
  items: FoodInput[];
  catalogVersion?: string;
  school?: SchoolRef & { menu: string[] };
  skipped?: boolean;
  previous?: { id: string; revision: number };
};

export type MealDayInput = {
  date: string;
  requestId: string;
  meals: DayMealInput[];
};

export function useSaveMealDay(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (input: MealDayInput) => {
      const headers = await csrfHeaders(userId);
      await apiClient.put('meals/day', input, { headers, timeout: 15_000 });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealsKey(userId) }),
  });
}

export function useSchoolChange(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (school: SchoolRef | null) => {
      const headers = await csrfHeaders(userId);
      if (school) return (await apiClient.put<School>('meals/school', school, { headers })).data;
      await apiClient.delete('meals/school', { headers });
      return null;
    },
    onSuccess: async (school) => {
      const schoolKey = [...mealsKey(userId), 'school'];
      await queryClient.cancelQueries({ queryKey: schoolKey, exact: true });
      queryClient.setQueryData(schoolKey, school);
      if (!school) queryClient.removeQueries({ queryKey: [...mealsKey(userId), 'menus'] });
      else return queryClient.invalidateQueries({ queryKey: [...mealsKey(userId), 'menus'] });
    },
  });
}

export function mealError(error: unknown, fallback: string) {
  if (!isAxiosError(error)) return fallback;
  const status = error.response?.status;
  if (status === 401 || status === 403) return '로그인 상태를 확인한 뒤 다시 시도해 주세요.';
  if (status && [400, 404, 409, 503].includes(status)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}
