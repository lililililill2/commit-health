import type { Metadata } from 'next';

import { commitCategories, HealthCommitPage } from '@/pages/health-commit';

export const metadata: Metadata = { title: '커밋하기 | Commit Health' };

export default function CommitPage() {
  return <HealthCommitPage categories={commitCategories} />;
}
