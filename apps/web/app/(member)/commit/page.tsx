import type { Metadata } from 'next';

import { MenuPlaceholderPage } from '@/pages/menu-placeholder';

export const metadata: Metadata = { title: '커밋하기 | Commit Health' };

export default function CommitPage() {
  return <MenuPlaceholderPage title="커밋하기" />;
}
