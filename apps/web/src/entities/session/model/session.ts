'use client';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { apiClient } from '@/shared/api';

export interface Session {
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

/** Builds the CSRF header for a write, refusing it if the signed-in user changed. */
export async function csrfHeaders(userId: string | undefined) {
  const session = await getSession();
  if (!session || session.user.id !== userId) throw new Error('Session changed');
  return { 'X-CSRF-Token': session.csrfToken };
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
