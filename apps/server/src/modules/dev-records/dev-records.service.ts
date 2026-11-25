import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { koreanDay } from '../../common/korean-day.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class DevRecordsService {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async resetToday(userId: string, confirmedDate: string): Promise<void> {
    if (this.config.get<string>('NODE_ENV') !== 'development') throw new NotFoundException();
    const frontend = new URL(this.config.getOrThrow<string>('FRONTEND_URL'));
    if (!['localhost', '127.0.0.1', '[::1]'].includes(frontend.hostname))
      throw new NotFoundException();

    const { recordDate } = koreanDay(new Date());
    if (confirmedDate !== recordDate)
      throw new ConflictException('날짜가 바뀌었어요. 오늘 기록을 다시 확인해 주세요.');

    const db = this.prisma.client;
    const where = { userId, recordDate: new Date(recordDate) };
    await db.$transaction([
      db.sleepRecord.deleteMany({ where }),
      db.conditionRecord.deleteMany({ where }),
      db.activitySession.deleteMany({ where }),
      db.caffeineRecord.deleteMany({ where }),
      db.mealRecord.deleteMany({ where }),
    ]);
  }
}
