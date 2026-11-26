import { ConflictException, Injectable } from '@nestjs/common';

import { Prisma, type SleepRecord } from '../../generated/prisma/client.js';
import { requireToday } from '../../common/korean-day.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateSleepDto } from './create-sleep.dto.js';
import { SleepClock } from './sleep-clock.js';
import { sleepDay, sleepWindow } from './sleep-time.js';

function serializeRecord(record: SleepRecord) {
  return {
    id: record.id,
    recordDate: record.recordDate.toISOString().slice(0, 10),
    bedtime: record.bedtime.toISOString(),
    wakeTime: record.wakeTime.toISOString(),
    durationMinutes: record.durationMinutes,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class SleepService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: SleepClock,
  ) {}

  async today(userId: string) {
    const day = sleepDay(this.clock.now());
    const record = await this.prisma.client.sleepRecord.findUnique({
      where: { userId_recordDate: { userId, recordDate: new Date(day.recordDate) } },
    });
    return { ...day, record: record ? serializeRecord(record) : null };
  }

  async create(userId: string, input: CreateSleepDto) {
    const now = this.clock.now();
    const day = sleepDay(now);
    requireToday(input.recordDate, now);
    const window = sleepWindow(input.recordDate, input.bedtime, input.wakeTime, now);
    try {
      const record = await this.prisma.client.sleepRecord.create({
        data: { userId, recordDate: new Date(day.recordDate), ...window },
      });
      return { ...day, record: serializeRecord(record) };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException(
          '오늘 수면 기록은 이미 확정됐어요. 확정한 기록은 수정할 수 없어요.',
        );
      throw error;
    }
  }
}
