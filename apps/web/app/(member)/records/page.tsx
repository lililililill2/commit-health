import type { Metadata } from 'next';

import { MenuPlaceholderPage } from '@/pages/menu-placeholder';

export const metadata: Metadata = { title: '기록 | Commit Health' };

export default function RecordsPage() {
  return <MenuPlaceholderPage title="기록" />;
}
