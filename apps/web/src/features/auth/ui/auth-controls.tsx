'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';

import { getSession, sessionQueryKey, useSession } from '@/entities/session';
import { apiClient } from '@/shared/api';

import { GoogleLoginButton } from './google-login-button';

export function AuthControls() {
  const session = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const logout = useMutation({
    mutationFn: async () => {
      const current = await getSession();
      if (!current) return;
      try {
        await apiClient.post('auth/logout', {}, { headers: { 'X-CSRF-Token': current.csrfToken } });
      } catch (error) {
        if (!isAxiosError(error) || error.response?.status !== 401) throw error;
      }
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      queryClient.setQueryData(sessionQueryKey, null);
      router.replace('/');
      router.refresh();
    },
  });

  if (session.isPending)
    return (
      <p role="status" className="py-3 text-sm">
        로그인 상태를 확인하고 있습니다…
      </p>
    );
  if (session.isError)
    return (
      <div className="space-y-4">
        <GoogleLoginButton />
        <div role="alert" className="text-sm">
          <p>로그인 상태를 확인하지 못했습니다.</p>
          <button type="button" className="mt-2 underline" onClick={() => void session.refetch()}>
            다시 확인
          </button>
        </div>
      </div>
    );
  if (!session.data) return <GoogleLoginButton />;

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={logout.isPending}
        onClick={() => logout.mutate()}
        className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-medium transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50"
      >
        {logout.isPending ? '로그아웃 중…' : '로그아웃'}
      </button>
      {logout.isError && (
        <p role="alert" className="text-sm text-red-400">
          로그아웃에 실패했습니다. 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
