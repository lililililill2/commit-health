export function koreanDay(now: Date) {
  const recordDate = new Date(now.getTime() + 9 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  const midnight = new Date(`${recordDate}T00:00:00+09:00`);
  return { recordDate, dayEndsAt: new Date(midnight.getTime() + 86_400_000).toISOString() };
}
