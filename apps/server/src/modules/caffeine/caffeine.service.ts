import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { koreanDay } from '../../common/korean-day.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { caffeineCatalog } from './caffeine-catalog.js';
import type { SaveCaffeineDto, SetCaffeineFreeDto } from './caffeine.dto.js';

function requireToday(recordDate: string, now: Date) {
  if (recordDate !== koreanDay(now).recordDate) {
    throw new ConflictException('날짜가 바뀌었어요. 오늘 기록을 다시 확인해 주세요.');
  }
  return new Date(recordDate);
}

@Injectable()
export class CaffeineService {
  constructor(private readonly prisma: PrismaService) {}

  async today(userId: string) {
    const day = koreanDay(new Date());
    const where = { userId, recordDate: new Date(day.recordDate) };
    const [records, caffeineFree] = await Promise.all([
      this.prisma.client.caffeineRecord.findMany({
        where,
        orderBy: [{ consumedAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          catalogId: true,
          drinkName: true,
          servingLabel: true,
          caffeineMg: true,
          consumedAt: true,
        },
      }),
      this.prisma.client.caffeineFreeDay.findUnique({
        where: { userId_recordDate: where },
        select: { userId: true },
      }),
    ]);
    const total = records.reduce(
      (sum, record) => sum.plus(record.caffeineMg),
      new Prisma.Decimal(0),
    );
    return {
      ...day,
      totalMg: total.toNumber(),
      caffeineFree: Boolean(caffeineFree) && records.length === 0,
      records: records.map((record) => ({
        ...record,
        caffeineMg: record.caffeineMg.toNumber(),
        consumedAt: record.consumedAt.toISOString(),
      })),
    };
  }

  async save(userId: string, input: SaveCaffeineDto, id?: string): Promise<void> {
    const now = new Date();
    const recordDate = requireToday(input.recordDate, now);
    const consumedAt = input.consumedTime
      ? new Date(`${input.recordDate}T${input.consumedTime}:00+09:00`)
      : now;
    if (consumedAt > now)
      throw new BadRequestException('섭취 시각을 현재보다 늦게 입력할 수 없어요.');

    let drink: {
      catalogId: string | null;
      drinkName: string;
      servingLabel: string | null;
      caffeineMg: Prisma.Decimal;
    };
    if (input.catalogId !== undefined) {
      const item = caffeineCatalog.find((product) => product.id === input.catalogId);
      if (!item || input.drinkName !== undefined || input.caffeineMg !== undefined) {
        throw new BadRequestException('목록에서 제품과 용량을 다시 선택해 주세요.');
      }
      drink = {
        catalogId: item.id,
        drinkName: `${item.brand} ${item.name}`,
        servingLabel: item.servingLabel,
        caffeineMg: new Prisma.Decimal(item.caffeineMg),
      };
    } else {
      const drinkName = input.drinkName?.trim();
      if (!drinkName || input.caffeineMg === undefined) {
        throw new BadRequestException('음료 이름과 카페인 함량을 입력해 주세요.');
      }
      const caffeineMg = new Prisma.Decimal(input.caffeineMg);
      if (caffeineMg.decimalPlaces() > 2) {
        throw new BadRequestException('카페인 함량은 소수 둘째 자리까지 입력해 주세요.');
      }
      drink = { catalogId: null, servingLabel: null, drinkName, caffeineMg };
    }

    const db = this.prisma.client;
    const records = db.caffeineRecord;
    const data = { ...drink, consumedAt };
    if (id === undefined) {
      await db.$transaction([
        records.create({ data: { ...data, userId, recordDate } }),
        db.caffeineFreeDay.deleteMany({ where: { userId, recordDate } }),
      ]);
      return;
    }
    const { count } = await records.updateMany({ where: { id, userId, recordDate }, data });
    if (!count) throw new NotFoundException('오늘 기록에서 이 음료를 찾을 수 없어요.');
  }

  async remove(userId: string, id: string, confirmedDate: string): Promise<void> {
    const recordDate = requireToday(confirmedDate, new Date());
    const { count } = await this.prisma.client.caffeineRecord.deleteMany({
      where: { id, userId, recordDate },
    });
    if (!count) throw new NotFoundException('오늘 기록에서 이 음료를 찾을 수 없어요.');
  }

  async setCaffeineFree(userId: string, input: SetCaffeineFreeDto): Promise<void> {
    const recordDate = requireToday(input.recordDate, new Date());
    const db = this.prisma.client;
    if (!input.caffeineFree) {
      await db.caffeineFreeDay.deleteMany({ where: { userId, recordDate } });
      return;
    }
    const drinks = await db.caffeineRecord.count({ where: { userId, recordDate } });
    if (drinks) throw new ConflictException('오늘 마신 음료 기록이 있어요. 기록을 확인해 주세요.');
    await db.caffeineFreeDay.upsert({
      where: { userId_recordDate: { userId, recordDate } },
      create: { userId, recordDate },
      update: {},
    });
  }
}
