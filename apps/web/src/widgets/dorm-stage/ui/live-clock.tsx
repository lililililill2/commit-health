'use client';

import { useSyncExternalStore } from 'react';

import styles from './dorm-stage.module.css';

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
    <div className={styles.clock} aria-label="현재 시간">
      <p className={styles.date}>{now ? dateFormat.format(now) : '오늘의 하루'}</p>
      <time className={styles.time} dateTime={now?.toISOString()}>
        {now ? timeFormat.format(now) : '--:--:--'}
      </time>
    </div>
  );
}
