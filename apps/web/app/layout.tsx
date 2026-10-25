import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AppProviders } from '@/app/providers';
import '@/app/styles/globals.css';

export const metadata: Metadata = {
  title: 'Commit Health',
  description: 'Commit Health 프로젝트 개발 환경',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
