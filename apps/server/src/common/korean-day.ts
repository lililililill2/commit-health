import { ConflictException } from '@nestjs/common';

export const RECORD_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function koreanDay(now: Date) {
  const recordDate = new Date(now.getTime() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const midnight = new Date(`${recordDate}T00:00:00+09:00`);
  return { recordDate, dayEndsAt: new Date(midnight.getTime() + 86_400_000).toISOString() };
}

/** Rejects writes prepared for a Korean calendar day that has already ended. */
export function requireToday(
  recordDate: string,
  now: Date,
  message = '날짜가 바뀌었어요. 오늘 기록을 다시 확인해 주세요.',
) {
  if (recordDate !== koreanDay(now).recordDate) throw new ConflictException(message);
  return new Date(recordDate);
}
