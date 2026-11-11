import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { commitCategories, getCommitCategory, HealthCommitDetailPage } from '@/pages/health-commit';

interface CommitDetailProps {
  params: Promise<{ category: string }>;
}

export function generateStaticParams() {
  return commitCategories.map((category) => ({ category: category.id }));
}

export async function generateMetadata({ params }: CommitDetailProps): Promise<Metadata> {
  const category = getCommitCategory((await params).category);
  if (!category) notFound();
  return { title: `${category.title} | Commit Health` };
}

export default async function CommitDetailPage({ params }: CommitDetailProps) {
  const category = getCommitCategory((await params).category);
  if (!category) notFound();
  return <HealthCommitDetailPage category={category} />;
}
