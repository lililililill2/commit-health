import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireToday } from '../../common/korean-day.js';
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

    const recordDate = requireToday(confirmedDate, new Date());

    const db = this.prisma.client;
    const where = { userId, recordDate };
    await db.$transaction([
      db.sleepRecord.deleteMany({ where }),
      db.conditionRecord.deleteMany({ where }),
      db.activitySession.deleteMany({ where }),
      db.caffeineRecord.deleteMany({ where }),
      db.caffeineFreeDay.deleteMany({ where }),
      db.mealRecord.deleteMany({ where }),
    ]);
  }
}
