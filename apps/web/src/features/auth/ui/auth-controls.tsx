'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { getSession, sessionQueryKey, useSession } from '@/entities/session';
import { apiBaseUrl, apiClient } from '@/shared/api';

export function GoogleLoginButton() {
  return (
    <a
      href={`${apiBaseUrl.replace(/\/$/, '')}/auth/google`}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-700"
    >
      Google로 로그인
    </a>
  );
}

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

  if (session.isPending) return <p role="status">로그인 상태를 확인하고 있습니다…</p>;
  if (session.isError)
    return (
      <div role="alert">
        <p>로그인 상태를 확인하지 못했습니다.</p>
        <button className="mt-2 underline" onClick={() => void session.refetch()}>
          다시 확인
        </button>
      </div>
    );
  if (!session.data) return <GoogleLoginButton />;

  return (
    <div className="space-y-3">
      <p className="font-medium text-emerald-700">Google 계정으로 로그인되어 있습니다.</p>
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/account" className="underline">
          내 계정
        </Link>
        <button
          type="button"
          disabled={logout.isPending}
          onClick={() => logout.mutate()}
          className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
        >
          {logout.isPending ? '로그아웃 중…' : '로그아웃'}
        </button>
      </div>
      {logout.isError && (
        <p role="alert" className="text-red-700">
          로그아웃에 실패했습니다. 다시 시도해 주세요.
        </p>
      )}
    </div>
  );
}
