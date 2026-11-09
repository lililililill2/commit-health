import Link from 'next/link';

import { GoogleLoginButton } from '@/features/auth';

export function AuthErrorPage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-5 py-12">
      <h1 className="text-2xl font-bold">Google 로그인에 실패했습니다.</h1>
      <p className="text-slate-600">
        로그인을 완료하지 못했습니다. 다시 시도해 주세요. 문제가 계속되면 네트워크 연결을 확인하거나
        잠시 후 다시 시도해 주세요.
      </p>
      <GoogleLoginButton />
      <p>
        <Link href="/" className="underline">
          홈으로
        </Link>
      </p>
    </main>
  );
}
