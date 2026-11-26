'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { caffeineQueryKey } from '@/entities/caffeine';
import { getSession } from '@/entities/session';
import { apiClient } from '@/shared/api';

type Drink = { catalogId: string } | { drinkName: string; caffeineMg: number };

type CaffeineChange =
  | {
      kind: 'save';
      id?: string;
      quantity: number;
      input: Drink & { recordDate: string; consumedTime?: string };
    }
  | { kind: 'remove'; id: string; recordDate: string }
  | { kind: 'caffeine-free'; recordDate: string; caffeineFree: boolean };

export class CaffeineQuantitySaveError extends Error {
  constructor(
    readonly saved: number,
    readonly uncertain: boolean,
    cause: unknown,
  ) {
    super('Caffeine quantity was not fully saved', { cause });
  }
}

export function useRecordCaffeine(userId: string) {
  const queryClient = useQueryClient();
  const queryKey = caffeineQueryKey(userId);

  return useMutation({
    retry: false,
    mutationFn: async (change: CaffeineChange) => {
      const session = await getSession();
      if (!session || session.user.id !== userId) throw new Error('Session changed');
      const options = { headers: { 'X-CSRF-Token': session.csrfToken } };

      if (change.kind === 'caffeine-free') {
        const { recordDate, caffeineFree } = change;
        await apiClient.put('caffeine/today/caffeine-free', { recordDate, caffeineFree }, options);
      } else if (change.kind === 'remove') {
        await apiClient.delete(`caffeine/${change.id}/${change.recordDate}`, options);
      } else if (change.id) {
        await apiClient.put(`caffeine/${change.id}`, change.input, options);
      } else {
        let saved = 0;
        try {
          for (; saved < change.quantity; saved += 1) {
            await apiClient.post('caffeine', change.input, options);
          }
        } catch (error) {
          if (change.quantity === 1) throw error;
          const status = isAxiosError(error) ? error.response?.status : undefined;
          const uncertain = status === undefined || status >= 500;
          if (saved === 0 && !uncertain) throw error;
          throw new CaffeineQuantitySaveError(saved, uncertain, error);
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: (error) => {
      if (
        error instanceof CaffeineQuantitySaveError ||
        (isAxiosError(error) && [404, 409].includes(error.response?.status ?? 0))
      ) {
        return queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function caffeineSaveError(error: unknown): string {
  if (error instanceof CaffeineQuantitySaveError) {
    return error.uncertain
      ? '저장 결과를 모두 확인하지 못했어요. 오늘의 음료 기록을 확인해 주세요.'
      : `${error.saved}개를 저장했어요. ${caffeineSaveError(error.cause)}`;
  }
  if (isAxiosError(error) && [400, 404, 409].includes(error.response?.status ?? 0)) {
    const message: unknown = error.response?.data?.message;
    return typeof message === 'string' ? message : '음료 이름과 카페인 함량을 확인해 주세요.';
  }
  return '기록을 저장하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}
