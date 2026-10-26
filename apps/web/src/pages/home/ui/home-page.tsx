'use client';

import { useQuery } from '@tanstack/react-query';

import { getHealth } from '@/shared/api';
import { AuthControls } from '@/features/auth';

export function HomePage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
  });

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-12 sm:px-8">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Commit Health</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          건강한 생활 습관을 위한 웹 서비스입니다. Google 계정으로 로그인할 수 있습니다.
        </p>
        <div className="mt-6">
          <AuthControls />
        </div>
        <div className="mt-8 rounded-xl bg-slate-50 p-5" role="status" aria-live="polite">
          <h2 className="text-sm font-semibold text-slate-600">API 연결 상태</h2>
          {isPending && <p className="mt-2 text-slate-600">API 연결을 확인하고 있습니다…</p>}
          {isError && (
            <p className="mt-2 font-medium text-red-700">
              API 연결 실패 · 백엔드 실행 상태와 API 환경변수를 확인하세요.
            </p>
          )}
          {data && (
            <p className="mt-2 font-medium text-emerald-700">API 연결 성공 · {data.service}</p>
          )}
        </div>
      </section>
    </main>
  );
}
