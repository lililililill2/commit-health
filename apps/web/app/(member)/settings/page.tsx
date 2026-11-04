import type { Metadata } from 'next';

import { MenuPlaceholderPage } from '@/pages/menu-placeholder';

export const metadata: Metadata = { title: '설정 | Commit Health' };

export default function SettingsPage() {
  return <MenuPlaceholderPage title="설정" />;
}
