import type { Metadata } from 'next';

import { MenuPlaceholderPage } from '@/pages/menu-placeholder';

export const metadata: Metadata = { title: '업적 | Commit Health' };

export default function AchievementsPage() {
  return <MenuPlaceholderPage title="업적" />;
}
