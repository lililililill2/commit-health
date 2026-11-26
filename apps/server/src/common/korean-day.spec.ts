import { ConflictException } from '@nestjs/common';
import { describe, expect, it } from '@jest/globals';

import { requireToday } from './korean-day.js';

describe('requireToday', () => {
  const beforeMidnight = new Date('2026-11-11T14:59:59.999Z');
  const atMidnight = new Date('2026-11-11T15:00:00Z');

  it('accepts the current Korean day until midnight', () => {
    expect(requireToday('2026-11-11', beforeMidnight)).toEqual(new Date('2026-11-11'));
  });

  it('rejects the previous day after Korean midnight with the given message', () => {
    expect(() => requireToday('2026-11-11', atMidnight)).toThrow(ConflictException);
    expect(() => requireToday('2026-11-11', atMidnight, '어제 기록이에요.')).toThrow(
      '어제 기록이에요.',
    );
    expect(requireToday('2026-11-12', atMidnight)).toEqual(new Date('2026-11-12'));
  });
});
