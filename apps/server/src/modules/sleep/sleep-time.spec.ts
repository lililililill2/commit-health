import { describe, expect, it } from '@jest/globals';

import { sleepDay, sleepWindow } from './sleep-time.js';

describe('sleep dates and durations', () => {
  const now = new Date('2026-11-10T03:00:00Z');

  it('changes the record date exactly at Korean midnight', () => {
    expect(sleepDay(new Date('2026-11-10T14:59:59.999Z'))).toEqual({
      recordDate: '2026-11-10',
      dayEndsAt: '2026-11-10T15:00:00.000Z',
    });
    expect(sleepDay(new Date('2026-11-10T15:00:00Z'))).toEqual({
      recordDate: '2026-11-11',
      dayEndsAt: '2026-11-11T15:00:00.000Z',
    });
  });

  it('uses the waking date and the previous bedtime date across midnight', () => {
    expect(sleepWindow('2026-11-10', '23:00', '07:15', now)).toEqual({
      bedtime: new Date('2026-11-09T14:00:00Z'),
      wakeTime: new Date('2026-11-09T22:15:00Z'),
      durationMinutes: 495,
    });
  });

  it('calculates same-day sleep and a single 15-minute interval', () => {
    expect(sleepWindow('2026-11-10', '01:00', '06:30', now).durationMinutes).toBe(330);
    expect(sleepWindow('2026-11-10', '00:00', '00:15', now).durationMinutes).toBe(15);
  });

  it.each([
    ['07:00', '07:00'],
    ['23:01', '07:01'],
    ['24:00', '07:00'],
  ])('rejects invalid times %s–%s', (bedtime, wakeTime) => {
    expect(() => sleepWindow('2026-11-10', bedtime, wakeTime, now)).toThrow();
  });

  it('explains that a valid quarter-hour is in the future and accepts the current time', () => {
    expect(() => sleepWindow('2026-11-10', '23:00', '12:15', now)).toThrow(
      '일어난 시간이 현재보다 늦어요. 시간을 다시 확인해 주세요.',
    );
    expect(sleepWindow('2026-11-10', '23:00', '12:00', now).wakeTime).toEqual(now);
  });
});
