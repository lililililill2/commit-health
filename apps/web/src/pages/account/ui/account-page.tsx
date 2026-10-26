import Link from 'next/link';

import { AuthControls, RequireSession } from '@/features/auth';

export function AccountPage() {
  return (
    <main className="mx-auto max-w-xl px-5 py-12">
      <RequireSession>
        <h1 className="mb-6 text-3xl font-bold">내 계정</h1>
        <p className="mb-6 text-slate-600">로그인한 사용자만 접근할 수 있는 화면입니다.</p>
        <AuthControls />
        <Link href="/" className="mt-8 inline-block underline">
          홈으로
        </Link>
      </RequireSession>
    </main>
  );
}
