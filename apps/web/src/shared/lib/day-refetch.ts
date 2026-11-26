/**
 * Refetch interval for today's records: polls at most every `maxMs`, and refreshes
 * just after the Korean day ends so the screen moves to the new date.
 */
export function refetchUntilDayEnds(
  dayEndsAt: string | undefined,
  maxMs = 60_000,
  now = Date.now(),
) {
  if (!dayEndsAt) return false;
  return Math.max(1_000, Math.min(maxMs, Date.parse(dayEndsAt) - now + 100));
}
