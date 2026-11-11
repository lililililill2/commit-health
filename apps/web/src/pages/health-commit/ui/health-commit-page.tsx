'use client';

import Link from 'next/link';

import { useSession } from '@/entities/session';
import { formatSleepDuration, useTodaySleep } from '@/entities/sleep';
import { formatActivityDuration, useTodayActivity } from '@/entities/activity';

import { cn } from '@/shared/lib';

import type { CommitCategory } from '../model/commit-category';
import { AppActivitySummary } from './app-activity-summary';

export function HealthCommitPage({ categories }: { categories: readonly CommitCategory[] }) {
  const session = useSession();
  const sleep = useTodaySleep(session.data?.user.id);
  const activity = useTodayActivity(session.data?.user.id);
  const record = sleep.data?.record;
  const completed: { id: string; title: string; summary: string }[] = [];
  if (record)
    completed.push({
      id: 'sleep',
      title: '수면',
      summary: formatSleepDuration(record.durationMinutes),
    });
  if (activity.data?.focus.count)
    completed.push({
      id: 'focus',
      title: '집중',
      summary: `${activity.data.focus.count}회 · ${formatActivityDuration(activity.data.focus.seconds)}`,
    });
  if (activity.data?.meditation.count)
    completed.push({
      id: 'meditation',
      title: '명상',
      summary: `${activity.data.meditation.count}회 · ${formatActivityDuration(activity.data.meditation.seconds)}`,
    });
  if (activity.data?.condition)
    completed.push({
      id: 'condition',
      title: '컨디션',
      summary: `${activity.data.condition.score} / 100 · 오늘 수정 가능`,
    });
  const completedIds = new Set(completed.map((item) => item.id));
  const pending = categories.filter((category) => !completedIds.has(category.id));
  const failed = (sleep.isError && !sleep.data) || (activity.isError && !activity.data);
  return (
    <main className="mx-auto w-full max-w-6xl">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-sm text-white/70 hover:text-[#7db8ff] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff]"
      >
        ← 메인으로
      </Link>
      <h1 className="mt-8 text-2xl font-medium">커밋하기</h1>
      <p className="mt-3 text-sm text-white/60">기록할 항목을 선택해 주세요.</p>
      <AppActivitySummary />
      <hr className="my-8 border-0 border-t border-white/15" />
      {failed && (
        <p role="alert" className="mb-5 text-sm text-red-300">
          완료한 기록을 불러오지 못했어요.{' '}
          <button
            type="button"
            onClick={() => {
              void sleep.refetch();
              void activity.refetch();
            }}
            className="underline"
          >
            다시 시도
          </button>
        </p>
      )}
      <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {pending.map((category) => (
          <li key={category.id}>
            <Link
              href={`/commit/${category.id}`}
              className={cn(
                'flex h-full min-h-36 items-start justify-between gap-4 rounded-xl border border-white/20 bg-white/5 p-5',
                'transition-colors hover:border-[#7db8ff] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff]',
              )}
            >
              <div>
                <h2 className="text-base font-medium">{category.title}</h2>
                <p className="mt-3 text-sm leading-6 break-keep text-white/60">
                  {category.description}
                </p>
              </div>
              <span aria-hidden="true" className="text-white/50">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="completed-heading" className="mt-10">
        <h2 id="completed-heading" className="text-lg font-medium">
          완료한 항목
        </h2>
        {completed.length > 0 ? (
          <ul className="mt-4 grid list-none gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {completed.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/commit/${item.id}`}
                  className="flex min-h-36 items-start justify-between gap-4 rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
                >
                  <div>
                    <h3 className="font-medium">
                      {item.title} <span className="sr-only">완료</span>
                    </h3>
                    <p className="mt-3 text-sm text-white/70">{item.summary}</p>
                  </div>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="size-6 shrink-0 text-emerald-400"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="m7 12 3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-white/50">
            {sleep.isPending || activity.isPending
              ? '오늘의 기록을 불러오는 중…'
              : failed
                ? '기록 상태를 확인해 주세요.'
                : '아직 완료한 항목이 없어요.'}
          </p>
        )}
      </section>
    </main>
  );
}
