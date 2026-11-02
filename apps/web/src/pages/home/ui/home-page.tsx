'use client';

import Image from 'next/image';

import { useSession } from '@/entities/session';
import { AuthControls } from '@/features/auth';
import { DormViewer } from '@/features/dorm-viewer';

import styles from './home-page.module.css';

export function HomePage() {
  const session = useSession();

  if (session.data)
    return (
      <main className={styles.shell} aria-labelledby="dorm-heading">
        <h1 id="dorm-heading" className="sr-only">
          나의 기숙사
        </h1>
        <header className={styles.header}>
          <Image
            src="/brand/commit-health-logo.svg"
            alt="Commit Health"
            width={204}
            height={30}
            className={styles.logo}
            preload
          />
        </header>
        <div className={styles.scene}>
          <DormViewer />
        </div>
        <div className={styles.footer} aria-hidden="true" />
      </main>
    );

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
