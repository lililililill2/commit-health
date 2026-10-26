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

  if (session.isError)
    return (
      <div role="alert">
        <p>로그인 상태를 확인하지 못했습니다.</p>
        <button onClick={() => void session.refetch()} className="mt-2 underline">
          다시 확인
        </button>
      </div>
    );
  if (session.isPending || !session.data)
    return <p role="status">로그인 상태를 확인하고 있습니다…</p>;
  return children;
}
