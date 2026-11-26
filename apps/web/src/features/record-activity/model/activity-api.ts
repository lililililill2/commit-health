import { isAxiosError } from 'axios';
import { csrfHeaders } from '@/entities/session';
import type { ActivitySession } from '@/entities/activity';
import { apiBaseUrl, apiClient } from '@/shared/api';

export function activityError(error: unknown) {
  if (isAxiosError(error) && [400, 409].includes(error.response?.status ?? 0)) {
    const message: unknown = error.response?.data?.message;
    if (typeof message === 'string') return message;
  }
  return '연결 상태를 확인한 뒤 다시 시도해 주세요.';
}
export function activityTimerApi(userId: string | undefined, kind: ActivitySession['kind']) {
  let headers: Record<string, string> = {};
  return {
    async start() {
      headers = await csrfHeaders(userId);
      return (await apiClient.post<ActivitySession>('activity/sessions', { kind }, { headers }))
        .data;
    },
    async heartbeat(id: string) {
      await apiClient.post(`activity/sessions/${id}/heartbeat`, {}, { headers });
    },
    async complete(id: string, stretch: { leftMs: number; rightMs: number }) {
      await apiClient.post(`activity/sessions/${id}/stretching-complete`, stretch, { headers });
    },
    async completeMeditation(id: string, playedSeconds: number) {
      await apiClient.post(
        `activity/sessions/${id}/meditation-complete`,
        { playedSeconds },
        { headers, adapter: 'fetch', fetchOptions: { keepalive: true } },
      );
    },
    async fail(id: string) {
      // Keepalive can finish while a route or document is being left. Missing requests expire server-side.
      const response = await fetch(
        `${apiBaseUrl.replace(/\/$/, '')}/activity/sessions/${id}/fail`,
        {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: '{}',
        },
      );
      if (!response.ok) throw new Error('Could not end activity');
    },
  };
}
