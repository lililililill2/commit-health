'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';

import { sessionQueryKey, useSession, type Session } from '@/entities/session';
import { apiClient } from '@/shared/api';
import { createSessionActivity, observeSessionActivity } from '../model/session-activity';

export function SessionActivity() {
  const session = useSession();
  const userId = session.data?.user.id;
  const csrfToken = session.data?.csrfToken;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !csrfToken) return;
    const tracker = createSessionActivity({
      now: () => performance.now(),
      visible: () => document.visibilityState === 'visible' && document.hasFocus(),
      schedule: (callback, delay) => {
        const id = window.setTimeout(callback, delay);
        return () => window.clearTimeout(id);
      },
      renew: (signal) =>
        apiClient.post('auth/activity', {}, { signal, headers: { 'X-CSRF-Token': csrfToken } }),
      onError: (error) => {
        if (isAxiosError(error) && error.response?.status === 401)
          queryClient.setQueryData<Session | null>(sessionQueryKey, (current) =>
            current?.user.id === userId && current.csrfToken === csrfToken ? null : current,
          );
        else if (isAxiosError(error) && error.response?.status === 403)
          void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
      },
    });
    const unsubscribe = observeSessionActivity(document, window, tracker.activity);
    return () => {
      unsubscribe();
      tracker.stop();
    };
  }, [userId, csrfToken, queryClient]);

  return null;
}
