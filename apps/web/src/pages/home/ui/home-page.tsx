'use client';

import Image from 'next/image';

import { useSession } from '@/entities/session';
import { GoogleLoginButton } from '@/features/auth';
import { DormStage } from '@/widgets/dorm-stage';

export function HomePage() {
  const session = useSession();

  if (session.data) return <DormStage title="나의 기숙사" />;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#111113] px-6 py-12 text-white">
      <section aria-labelledby="login-heading" className="w-full max-w-xs text-center">
        <h1 id="login-heading" className="sr-only">
          {session.isPending || session.isError ? 'Commit Health' : 'Commit Health 로그인'}
        </h1>
        <div className="flex justify-center">
          <Image
            src="/brand/commit-health-logo.svg"
            alt="Commit Health"
            width={204}
            height={30}
            className="h-[30px] w-auto"
            preload
          />
        </div>
        <div className="mt-12 flex min-h-12 items-center justify-center">
          {session.isPending ? (
            <div role="status">
              <span
                aria-hidden="true"
                className="block size-7 animate-spin rounded-full border-2 border-white/20 border-t-white/80 motion-reduce:animate-none"
              />
              <span className="sr-only">화면을 불러오는 중</span>
            </div>
          ) : session.isError ? (
            <div role="alert" className="w-full space-y-4">
              <p className="text-sm text-white/70">
                일시적으로 연결할 수 없어요. 잠시 후 다시 시도해 주세요.
              </p>
              <button
                type="button"
                disabled={session.isFetching}
                onClick={() => void session.refetch()}
                className="min-h-11 w-full cursor-pointer rounded-lg border border-white/30 px-5 py-2 text-sm transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:cursor-wait disabled:opacity-50"
              >
                {session.isFetching ? '다시 시도 중…' : '다시 시도'}
              </button>
            </div>
          ) : (
            <GoogleLoginButton />
          )}
        </div>
      </section>
    </main>
  );
}
