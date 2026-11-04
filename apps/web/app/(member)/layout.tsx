import type { ReactNode } from 'react';

import { RequireSession } from '@/features/auth';

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#111113] px-6 py-8 text-white">
      <RequireSession>{children}</RequireSession>
    </div>
  );
}
