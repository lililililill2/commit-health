export function formatActivityDuration(seconds: number) {
  const hours = Math.floor(seconds / 3_600),
    minutes = Math.floor((seconds % 3_600) / 60),
    rest = seconds % 60;
  return [
    hours ? `${hours}시간` : '',
    minutes ? `${minutes}분` : '',
    rest || (!hours && !minutes) ? `${rest}초` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
export function timerDigits(seconds: number) {
  return [Math.floor(seconds / 3_600), Math.floor((seconds % 3_600) / 60), seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}
