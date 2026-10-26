'use client';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { apiClient } from '@/shared/api';

interface Session {
  user: { id: string; createdAt: string; updatedAt: string };
  csrfToken: string;
}

export const sessionQueryKey = ['session'] as const;

export async function getSession(signal?: AbortSignal): Promise<Session | null> {
  try {
    const { data } = await apiClient.get<Session>('auth/me', { signal });
    return data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) return null;
    throw error;
  }
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => getSession(signal),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: true,
  });
}
