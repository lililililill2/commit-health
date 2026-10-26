import Image from 'next/image';

import { apiBaseUrl } from '@/shared/api';

export function GoogleLoginButton() {
  return (
    <a
      href={`${apiBaseUrl.replace(/\/$/, '')}/auth/google`}
      className="inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2.5 rounded-lg border border-[#747775] bg-white px-3 py-3 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f2f2f2] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-500"
    >
      <Image src="/brand/google-g.png" alt="" width={18} height={18} />
      구글로 로그인하기
    </a>
  );
}
