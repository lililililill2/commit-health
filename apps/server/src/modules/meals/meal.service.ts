import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { koreanDay } from '../../common/korean-day.js';
import { Prisma, type MealRecord } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { catalogById, catalogVersion, servingById } from './meal-catalog.js';
import {
  mealKinds,
  type MealKind,
  type SaveMealDayDto,
  type SaveMealDto,
  type SchoolDto,
} from './meal.dto.js';
import { NeisService } from './neis.service.js';

type PortionSnapshot = {
  portions?: number;
  kcalPerPortion?: number | null;
  energyKcal?: number | null;
  servingSourceUrl?: string;
};

type MealItem =
  | ({ id: string; source: 'MANUAL'; name: string } & PortionSnapshot)
  | {
      id: string;
      source: 'SCHOOL';
      name: string;
      schoolName: string;
      schoolMealKcal?: number | null;
    }
  | ({
      id: string;
      source: 'CATALOG';
      name: string;
      foodId: string;
      kcal: number;
      amount?: number | null;
      basis: string;
      sourceCode: string;
      sourceName: string;
      dataset: string;
      catalogVersion: string;
      referenceType?: string;
    } & PortionSnapshot);

const selectSchool = { officeCode: true, schoolCode: true, name: true, region: true } as const;
const historySelect = { items: true, recordDate: true, updatedAt: true } as const;

export function mealDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date ||
    date < '1900-01-01'
  )
    throw new BadRequestException('날짜를 확인해 주세요.');
  return value;
}

function asItems(value: Prisma.JsonValue) {
  // Only this service writes item snapshots, after validating every input.
  return value as MealItem[];
}

function energyFor(kcalPer100: number, amount: number | null) {
  return amount === null ? null : Math.round(kcalPer100 * amount) / 100;
}

function portionSnapshot(
  input: SaveMealDto['items'][number],
  reference?: { kcal: number; sourceUrl: string },
): PortionSnapshot {
  if (input.portions == null) {
    if (input.kcalPerPortion != null) throw new BadRequestException('인분 수를 확인해 주세요.');
    return {};
  }
  if (input.amount !== undefined || (reference && input.kcalPerPortion != null))
    throw new BadRequestException('인분과 열량 입력을 확인해 주세요.');
  const kcalPerPortion = reference?.kcal ?? input.kcalPerPortion ?? null;
  return {
    portions: input.portions,
    kcalPerPortion,
    energyKcal:
      kcalPerPortion === null ? null : Math.round(kcalPerPortion * input.portions * 100) / 100,
    ...(reference ? { servingSourceUrl: reference.sourceUrl } : {}),
  };
}

function view(record: MealRecord) {
  return {
    id: record.id,
    date: record.recordDate.toISOString().slice(0, 10),
    kind: record.kind,
    revision: record.revision,
    items: asItems(record.items),
  };
}

function isUniqueConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class MealService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly neis: NeisService,
  ) {}

  async day(userId: string, date: string) {
    const records = await this.prisma.client.mealRecord.findMany({
      where: { userId, recordDate: mealDate(date) },
      orderBy: { kind: 'asc' },
    });
    return records.map(view);
  }

  async history(userId: string) {
    const { recordDate } = koreanDay(new Date());
    const since = mealDate(recordDate);
    since.setUTCDate(since.getUTCDate() - 29);
    const records = await this.prisma.client.mealRecord.findMany({
      where: { userId, recordDate: { gte: since, lte: mealDate(recordDate) } },
      orderBy: [{ recordDate: 'desc' }, { updatedAt: 'desc' }],
      take: 120,
      select: historySelect,
    });
    const foods = new Map<string, { name: string; foodId: string | null; count: number }>();
    for (const record of records) {
      const counted = new Set<string>();
      for (const item of asItems(record.items)) {
        if (item.source === 'SCHOOL') continue;
        const foodId = item.source === 'CATALOG' ? item.foodId : null;
        const key = foodId ?? item.name.normalize('NFKC').replace(/\s/gu, '').toLowerCase();
        if (counted.has(key)) continue;
        counted.add(key);
        const entry = foods.get(key);
        if (entry) entry.count += 1;
        else foods.set(key, { name: item.name, foodId, count: 1 });
      }
    }
    const entries = [...foods.values()];
    return {
      recent: entries.slice(0, 6),
      frequent: entries
        .filter(({ count }) => count > 1)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    };
  }

  async todayProgress(userId: string) {
    const day = koreanDay(new Date());
    const where = { userId, recordDate: mealDate(day.recordDate) };
    const db = this.prisma.client;
    const [meals, sleep, condition, activities, caffeine] = await Promise.all([
      db.mealRecord.findMany({ where, select: { kind: true, items: true } }),
      db.sleepRecord.findFirst({ where, select: { id: true } }),
      db.conditionRecord.findFirst({ where, select: { id: true } }),
      db.activitySession.groupBy({ by: ['kind'], where: { ...where, status: 'COMPLETED' } }),
      db.caffeineRecord.findFirst({ where, select: { id: true } }),
    ]);
    const mainMeals = meals.filter(
      ({ kind, items }) => kind !== 'SNACK' && asItems(items).length > 0,
    ).length;
    return {
      ...day,
      mealCount: meals.length,
      mainMeals,
      dailyRecordCount:
        [mainMeals > 0, sleep, condition, caffeine].filter(Boolean).length + activities.length,
    };
  }

  school(userId: string) {
    return this.prisma.client.userSchool.findUnique({ where: { userId }, select: selectSchool });
  }

  async setSchool(userId: string, input: SchoolDto) {
    const school = (await this.neis.schools(input)).find(
      (row) => row.officeCode === input.officeCode && row.schoolCode === input.schoolCode,
    );
    if (!school) throw new NotFoundException('학교를 찾을 수 없어요.');
    return this.prisma.client.userSchool.upsert({
      where: { userId },
      create: { userId, ...school },
      update: school,
      select: selectSchool,
    });
  }

  async removeSchool(userId: string) {
    await this.prisma.client.userSchool.deleteMany({ where: { userId } });
  }

  async menus(userId: string, date: string) {
    mealDate(date);
    const school = await this.school(userId);
    return school ? { school, meals: await this.neis.menus(school, date) } : { school, meals: [] };
  }

  private async snapshot(userId: string, input: SaveMealDto, current?: MealRecord) {
    if (input.items.some((item) => item.foodId) && input.catalogVersion !== catalogVersion)
      throw new ConflictException(
        '음식 목록이 바뀌었어요. 목록을 새로 불러온 뒤 다시 저장해 주세요.',
      );

    const saved = new Map(current ? asItems(current.items).map((item) => [item.id, item]) : []);
    const items: MealItem[] = [];
    for (const item of input.items) {
      if ([item.savedId, item.foodId, item.name].filter(Boolean).length !== 1)
        throw new BadRequestException('음식 항목을 확인해 주세요.');
      if (item.savedId) {
        const snapshot = saved.get(item.savedId);
        if (!snapshot) throw new BadRequestException('기존 음식 항목을 확인해 주세요.');
        if (item.portions != null) {
          if (snapshot.source === 'SCHOOL')
            throw new BadRequestException('급식 항목은 수정할 수 없어요.');
          const reference =
            snapshot.servingSourceUrl && snapshot.kcalPerPortion != null
              ? { sourceUrl: snapshot.servingSourceUrl, kcal: snapshot.kcalPerPortion }
              : undefined;
          items.push({
            ...snapshot,
            ...(snapshot.source === 'CATALOG' ? { amount: null } : {}),
            ...portionSnapshot(item, reference),
          });
        } else if (
          item.amount !== undefined &&
          snapshot.source === 'CATALOG' &&
          snapshot.portions == null
        ) {
          portionSnapshot(item);
          items.push({
            ...snapshot,
            amount: item.amount,
            energyKcal: energyFor(snapshot.kcal, item.amount),
          });
        } else {
          if (item.amount != null || item.kcalPerPortion != null)
            throw new BadRequestException('검색한 음식에만 양을 입력할 수 있어요.');
          items.push(snapshot);
        }
        saved.delete(item.savedId);
      } else if (item.foodId) {
        const food = catalogById.get(item.foodId);
        if (!food) throw new BadRequestException('음식 목록에서 다시 선택해 주세요.');
        const serving = servingById.get(food.id);
        const reference =
          serving && food.basis === '100g'
            ? { kcal: energyFor(food.kcal, serving.grams)!, sourceUrl: serving.sourceUrl }
            : undefined;
        items.push({
          id: randomUUID(),
          source: 'CATALOG',
          name: food.name,
          foodId: food.id,
          kcal: food.kcal,
          amount: item.amount ?? null,
          energyKcal: energyFor(food.kcal, item.amount ?? null),
          basis: food.basis,
          sourceCode: food.sourceCode,
          sourceName: food.sourceName,
          dataset: food.dataset,
          catalogVersion,
          ...(food.referenceType ? { referenceType: food.referenceType } : {}),
          ...portionSnapshot(item, reference),
        });
      } else if (item.name) {
        if (item.amount != null)
          throw new BadRequestException('검색한 음식에만 양을 입력할 수 있어요.');
        items.push({
          id: randomUUID(),
          source: 'MANUAL',
          name: item.name,
          ...portionSnapshot(item),
        });
      }
    }

    if (input.school) {
      if (input.kind === 'SNACK' || items.some((item) => item.source === 'SCHOOL'))
        throw new BadRequestException('급식은 한 식사에 한 번만 추가할 수 있어요.');
      const school = await this.school(userId);
      if (
        !school ||
        school.officeCode !== input.school.officeCode ||
        school.schoolCode !== input.school.schoolCode
      )
        throw new ConflictException('등록한 학교가 변경됐어요. 급식 목록을 다시 확인해 주세요.');
      const menu = (await this.neis.menus(school, input.date)).find(
        ({ kind }) => kind === input.kind,
      );
      if (!menu) throw new ConflictException('선택한 날짜의 급식 메뉴를 찾을 수 없어요.');
      if (JSON.stringify(menu.items) !== JSON.stringify(input.school.menu))
        throw new ConflictException('급식 메뉴가 변경됐어요. 새 메뉴를 확인해 주세요.');
      items.push(
        ...menu.items.map((name): MealItem => ({
          id: randomUUID(),
          source: 'SCHOOL',
          name,
          schoolName: school.name,
          schoolMealKcal: menu.mealKcal,
        })),
      );
    }
    if (items.length < 1 || items.length > 40)
      throw new BadRequestException('음식을 1개 이상, 40개 이하로 넣어 주세요.');
    const keys = items.map((item) =>
      item.source === 'CATALOG'
        ? item.foodId
        : `${item.source}:${item.name.normalize('NFKC').replace(/\s/gu, '').toLowerCase()}`,
    );
    if (keys.length !== new Set(keys).size)
      throw new BadRequestException('같은 음식은 한 번만 넣어 주세요.');
    return items;
  }

  async save(userId: string, input: SaveMealDto, edit?: { id: string; revision: number }) {
    const recordDate = mealDate(input.date);
    if (input.date > koreanDay(new Date()).recordDate)
      throw new BadRequestException('미래 날짜에는 식사를 기록할 수 없어요.');
    const db = this.prisma.client.mealRecord;
    const slot = { userId, recordDate, kind: input.kind };
    const current = await db.findFirst({ where: edit ? { ...slot, id: edit.id } : slot });
    if (current?.requestId === input.requestId) return view(current);

    if (edit && !current) throw new NotFoundException('식사 기록을 찾을 수 없어요.');
    if (edit && current?.revision !== edit.revision)
      throw new ConflictException('식사 기록이 변경됐어요. 목록을 새로 확인해 주세요.');
    if (!edit && current) throw new ConflictException('이 식사는 이미 기록돼 있어요.');

    const items = await this.snapshot(userId, input, current ?? undefined);
    const data = { items, requestId: input.requestId };
    if (edit) {
      const [updated] = await db.updateManyAndReturn({
        where: { ...slot, id: edit.id, revision: edit.revision },
        data: { ...data, revision: { increment: 1 } },
      });
      if (updated) return view(updated);
    } else {
      try {
        return view(await db.create({ data: { ...slot, ...data } }));
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
      }
    }
    const changed = await db.findFirst({ where: edit ? { ...slot, id: edit.id } : slot });
    if (changed?.requestId === input.requestId) return view(changed);
    throw new ConflictException('식사 기록이 변경됐어요. 목록을 새로 확인해 주세요.');
  }

  async saveDay(userId: string, input: SaveMealDayDto): Promise<void> {
    const recordDate = mealDate(input.date);
    if (input.date > koreanDay(new Date()).recordDate)
      throw new BadRequestException('미래 날짜에는 식사를 기록할 수 없어요.');
    const byKind = new Map(input.meals.map((entry) => [entry.kind, entry]));
    if (
      byKind.size !== input.meals.length ||
      mealKinds.some((kind) => kind !== 'SNACK' && !byKind.has(kind))
    )
      throw new BadRequestException('아침·점심·저녁을 각각 기록해 주세요.');

    const db = this.prisma.client;
    const scope = { userId, recordDate };
    const records = new Map(
      (await db.mealRecord.findMany({ where: scope })).map((record) => [record.kind, record]),
    );
    const conflict = () =>
      new ConflictException(
        '다른 화면에서 기록이 바뀌었어요. 초안을 되돌린 뒤 다시 확인해 주세요.',
      );
    const writes: {
      kind: MealKind;
      current: MealRecord | undefined;
      items: MealItem[];
      removeSnack: boolean;
    }[] = [];

    // Resolve NEIS and validate all entries before opening a database transaction.
    for (const kind of mealKinds) {
      const entry = byKind.get(kind);
      if (!entry) continue;
      const current = records.get(kind);
      const empty = !entry.items.length && !entry.school;
      const removeSnack = kind === 'SNACK' && empty && !entry.skipped;
      if (entry.skipped ? kind === 'SNACK' || !empty : empty && !removeSnack)
        throw new BadRequestException('먹은 음식 또는 안 먹었어요를 선택해 주세요.');
      if (current?.requestId === input.requestId || (removeSnack && !current)) continue;
      if (current?.id !== entry.previous?.id || current?.revision !== entry.previous?.revision)
        throw conflict();

      const items = empty
        ? []
        : await this.snapshot(
            userId,
            {
              ...entry,
              date: input.date,
              requestId: input.requestId,
            },
            current,
          );
      writes.push({ kind, current, items, removeSnack });
    }
    if (!writes.length) return;

    try {
      await db.$transaction(async (tx) => {
        for (const { kind, current, items, removeSnack } of writes) {
          const data = { items, requestId: input.requestId };
          if (current) {
            const where = { ...scope, kind, id: current.id, revision: current.revision };
            const result = removeSnack
              ? await tx.mealRecord.deleteMany({ where })
              : await tx.mealRecord.updateMany({
                  where,
                  data: { ...data, revision: { increment: 1 } },
                });
            if (result.count !== 1) throw conflict();
          } else {
            await tx.mealRecord.create({ data: { ...scope, kind, ...data } });
          }
        }
      });
    } catch (error) {
      if (isUniqueConflict(error)) throw conflict();
      throw error;
    }
  }

  async remove(userId: string, id: string, revision: number) {
    const db = this.prisma.client.mealRecord;
    if ((await db.deleteMany({ where: { id, userId, revision } })).count) return;
    if (await db.findFirst({ where: { id, userId }, select: { id: true } }))
      throw new ConflictException('식사 기록이 변경됐어요. 목록을 새로 확인해 주세요.');
    throw new NotFoundException('식사 기록을 찾을 수 없어요.');
  }
}
