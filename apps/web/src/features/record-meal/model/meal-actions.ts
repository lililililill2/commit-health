import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { mealsKey, type MealKind, type MealRecord, type School } from '@/entities/meal';
import { getSession } from '@/entities/session';
import { apiClient } from '@/shared/api';

export type SchoolRef = Pick<School, 'officeCode' | 'schoolCode'>;
export type FoodInput = ({ savedId: string } | { foodId: string } | { name: string }) & {
  portions?: number;
  kcalPerPortion?: number | null;
};

export type MealInput = {
  date: string;
  kind: MealKind;
  items: FoodInput[];
  requestId: string;
  catalogVersion?: string;
};

type MealChange =
  | { action: 'save'; input: MealInput; edit?: { id: string; revision: number } }
  | { action: 'delete'; id: string; revision: number };

async function csrf(userId: string) {
  const session = await getSession();
  if (!session || session.user.id !== userId) throw new Error('Session changed');
  return { 'X-CSRF-Token': session.csrfToken };
}

export function useMealChange(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (change: MealChange) => {
      const headers = await csrf(userId);
      if (change.action === 'delete') {
        await apiClient.delete(`meals/${change.id}`, {
          headers,
          params: { revision: change.revision },
        });
      } else if (change.edit) {
        await apiClient.put<MealRecord>(
          `meals/${change.edit.id}`,
          { ...change.input, revision: change.edit.revision },
          { headers },
        );
      } else {
        await apiClient.post<MealRecord>('meals', change.input, { headers });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: mealsKey(userId) }),
  });
}

export function useSchoolChange(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    retry: false,
    mutationFn: async (school: SchoolRef | null) => {
      const headers = await csrf(userId);
      if (school) return (await apiClient.put<School>('meals/school', school, { headers })).data;
      await apiClient.delete('meals/school', { headers });
      return null;
    },
    onSuccess: (school) => {
      queryClient.setQueryData([...mealsKey(userId), 'school'], school);
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
