'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { csrfHeaders } from '@/entities/session';
import { sleepQueryKey, type SleepDay } from '@/entities/sleep';
import { apiClient } from '@/shared/api';

export interface SleepInput {
  recordDate: string;
  bedtime: string;
  wakeTime: string;
}

export function useRecordSleep(userId: string | undefined) {
  const queryClient = useQueryClient();
  const queryKey = sleepQueryKey(userId);
  return useMutation({
    mutationFn: async (input: SleepInput) => {
      const { data } = await apiClient.post<SleepDay>('sleep', input, {
        headers: await csrfHeaders(userId),
      });
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.cancelQueries({ queryKey });
      queryClient.setQueryData(queryKey, data);
    },
    onError: async (error) => {
      if (isAxiosError(error) && error.response?.status === 409)
        await queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function sleepSaveError(error: unknown): string {
  if (isAxiosError(error) && [400, 409].includes(error.response?.status ?? 0)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === 'string') return message;
    return '입력한 날짜와 시간을 확인해 주세요.';
  }
  return '기록을 저장하지 못했어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.';
}
