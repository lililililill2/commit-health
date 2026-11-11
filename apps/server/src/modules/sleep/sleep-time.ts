import { BadRequestException } from '@nestjs/common';

const DAY_MS = 24 * 60 * 60 * 1_000;
export { koreanDay as sleepDay } from '../../common/korean-day.js';

export function sleepWindow(recordDate: string, bedtime: string, wakeTime: string, now: Date) {
  const timePattern = /^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/;
  if (!timePattern.test(bedtime) || !timePattern.test(wakeTime))
    throw new BadRequestException('시간은 15분 단위로 선택해 주세요.');
  if (bedtime === wakeTime)
    throw new BadRequestException('잠든 시간과 일어난 시간을 다르게 선택해 주세요.');
  const wakeAt = new Date(`${recordDate}T${wakeTime}:00+09:00`);
  const bedAt = new Date(`${recordDate}T${bedtime}:00+09:00`);
  if (bedAt > wakeAt) bedAt.setTime(bedAt.getTime() - DAY_MS);
  const durationMinutes = (wakeAt.getTime() - bedAt.getTime()) / 60_000;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    durationMinutes >= 1_440 ||
    durationMinutes % 15 !== 0 ||
    wakeAt > now
  )
    throw new BadRequestException('일어난 시각은 현재 이전의 15분 단위 시간으로 선택해 주세요.');
  return { bedtime: bedAt, wakeTime: wakeAt, durationMinutes };
}
