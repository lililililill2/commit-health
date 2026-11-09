'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import { useSession } from '@/entities/session';

export function RequireSession({ children }: { children: ReactNode }) {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session.isSuccess && !session.data) router.replace('/');
  }, [session.isSuccess, session.data, router]);

  if (session.data) return children;
  if (session.isError)
    return (
      <div role="alert">
        <p>페이지를 불러오지 못했습니다.</p>
        <button
          type="button"
          disabled={session.isFetching}
          onClick={() => void session.refetch()}
          className="mt-2 min-h-11 cursor-pointer underline disabled:cursor-wait"
        >
          다시 시도
        </button>
      </div>
    );
  return (
    <div role="status" className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
      <span
        aria-hidden="true"
        className="block size-7 animate-spin rounded-full border-2 border-white/20 border-t-white/80 motion-reduce:animate-none"
      />
      <span className="sr-only">화면을 불러오는 중</span>
    </div>
  );
}
