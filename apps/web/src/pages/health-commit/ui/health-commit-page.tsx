'use client';

import Link from 'next/link';

import { useSession } from '@/entities/session';
import { useTodaySleep } from '@/entities/sleep';
import { useTodayActivity } from '@/entities/activity';
import { useTodayCaffeine } from '@/entities/caffeine';
import { useTodayMealProgress } from '@/entities/meal';

import type { CommitCategory } from '../model/commit-category';
import { AppActivitySummary } from './app-activity-summary';

export function HealthCommitPage({ categories }: { categories: readonly CommitCategory[] }) {
  const session = useSession();
  const sleep = useTodaySleep(session.data?.user.id);
  const activity = useTodayActivity(session.data?.user.id);
  const caffeine = useTodayCaffeine(session.data?.user.id);
  const meals = useTodayMealProgress(session.data?.user.id);
  const completed: Record<string, boolean> = {
    sleep: Boolean(sleep.data?.record),
    caffeine: Boolean(caffeine.data?.records.length || caffeine.data?.caffeineFree),
    meals: Boolean(meals.data?.mainMeals),
    meditation: Boolean(activity.data?.meditation.count),
    stretching: Boolean(activity.data?.stretching?.count),
    condition: Boolean(activity.data?.condition),
  };
  const failed =
    (sleep.isError && !sleep.data) ||
    (activity.isError && !activity.data) ||
    (caffeine.isError && !caffeine.data) ||
    (meals.isError && !meals.data);
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
              void caffeine.refetch();
              void meals.refetch();
            }}
            className="underline"
          >
            다시 시도
          </button>
        </p>
      )}
      <ul className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {categories.map((category) => (
          <li key={category.id}>
            <Link
              href={`/commit/${category.id}`}
              className="flex h-full min-h-36 items-start justify-between gap-2 rounded-xl border border-white/20 bg-white/5 p-3 transition-colors hover:border-[#7db8ff] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7db8ff] sm:gap-4 sm:p-5"
            >
              <div className="min-w-0">
                <h2 className="text-base font-medium">
                  {category.title}
                  {completed[category.id] && <span className="sr-only"> 완료</span>}
                </h2>
                <p className="mt-3 text-sm leading-6 wrap-anywhere break-keep text-white/60">
                  {category.description}
                </p>
              </div>
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
                {completed[category.id] ? (
                  <svg viewBox="0 0 24 24" fill="none" className="size-6 text-emerald-400">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="m7 12 3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <span className="text-white/50">→</span>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
