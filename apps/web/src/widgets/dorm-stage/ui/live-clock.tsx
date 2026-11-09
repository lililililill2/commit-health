'use client';

import { useSyncExternalStore } from 'react';

import { cn } from '@/shared/lib';

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const dateFormat = new Intl.DateTimeFormat('ko-KR', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
});

function subscribe(onChange: () => void) {
  const interval = window.setInterval(onChange, 1000);
  return () => window.clearInterval(interval);
}

function getSnapshot() {
  return Math.floor(Date.now() / 1000);
}

function getServerSnapshot() {
  return null;
}

export function LiveClock() {
  const seconds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const now = seconds === null ? null : new Date(seconds * 1000);
  return (
    <div
      className="shrink-0 text-right [text-shadow:0_2px_10px_rgb(0_0_0/30%)]"
      aria-label="현재 시간"
    >
      <p className="m-0 mb-1 text-[11px] font-normal tracking-[-0.02em] text-white/80">
        {now ? dateFormat.format(now) : '오늘의 하루'}
      </p>
      <time
        className={cn(
          'block text-[26px] leading-[1.15] font-normal tracking-[-0.035em] tabular-nums',
          'mobile:text-2xl',
        )}
        dateTime={now?.toISOString()}
      >
        {now ? timeFormat.format(now) : '--:--:--'}
      </time>
    </div>
  );
}
