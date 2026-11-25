export const sleepTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

export function sleepDuration(bedtime: string, wakeTime: string): number | null {
  if (!sleepTimeOptions.includes(bedtime) || !sleepTimeOptions.includes(wakeTime)) return null;
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const duration = (minutes(wakeTime) - minutes(bedtime) + 1_440) % 1_440;
  return duration === 0 ? null : duration;
}

export function formatSleepDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}시간` : '', remainder ? `${remainder}분` : ''].filter(Boolean).join(' ');
}

const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatSleepTime(value: string): string {
  return timeFormat.format(new Date(value));
}

export function shiftSleepTime(value: string, delta: number): string {
  const index = sleepTimeOptions.indexOf(value);
  if (index < 0 || !Number.isInteger(delta / 15)) return value;
  return sleepTimeOptions[(((index + delta / 15) % 96) + 96) % 96];
}
