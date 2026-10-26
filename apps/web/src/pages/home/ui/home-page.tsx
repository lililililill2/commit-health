import Image from 'next/image';

import { AuthControls } from '@/features/auth';

export function HomePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#111113] px-6 py-12 text-white">
      <section aria-labelledby="login-heading" className="w-full max-w-xs text-center">
        <h1 id="login-heading" className="sr-only">
          Commit Health 로그인
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
        <div className="mt-12 min-h-12">
          <AuthControls />
        </div>
      </section>
    </main>
  );
}
