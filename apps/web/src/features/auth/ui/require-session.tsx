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
  return null;
}
