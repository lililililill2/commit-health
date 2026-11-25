import Link from 'next/link';

import { SleepRecordForm } from '@/features/record-sleep';
import { ConditionForm, MeditationPanel, StretchingPanel } from '@/features/record-activity';
import { CaffeineRecordForm } from '@/features/record-caffeine';
import { MealPanel } from '@/features/record-meal';

import type { CommitCategory } from '../model/commit-category';

export function HealthCommitDetailPage({ category }: { category: CommitCategory }) {
  if (category.id === 'meditation') return <MeditationPanel />;

  return (
    <main className="mx-auto w-full max-w-6xl">
      <Link
        href="/commit"
        className="inline-flex min-h-11 items-center text-sm text-white/70 hover:text-[#7db8ff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff]"
      >
        ← 커밋하기 목록으로
      </Link>
      <h1 className="mt-8 text-2xl font-medium">{category.title}</h1>
      <p className="mt-3 text-sm text-white/60">{category.description}</p>
      {category.id === 'sleep' ? (
        <SleepRecordForm />
      ) : category.id === 'caffeine' ? (
        <CaffeineRecordForm />
      ) : category.id === 'meals' ? (
        <MealPanel />
      ) : category.id === 'condition' ? (
        <ConditionForm />
      ) : category.id === 'stretching' ? (
        <StretchingPanel />
      ) : (
        <div className="mt-8 rounded-xl border border-white/20 bg-white/5 p-6">
          <p className="text-sm text-white/70">기록 입력을 준비하고 있어요.</p>
        </div>
      )}
    </main>
  );
}
