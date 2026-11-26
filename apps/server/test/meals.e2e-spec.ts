import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { catalogById, catalogVersion } from '../src/modules/meals/meal-catalog.js';
import { NeisService } from '../src/modules/meals/neis.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const origin = 'http://localhost:3000';
const path = '/api/meals';
const token = 'a'.repeat(43);
const csrf = 'b'.repeat(43);
const userId = randomUUID();
const id = randomUUID();
const date = '2024-02-29';
const school = { officeCode: 'F10', schoolCode: '7380292', name: '테스트고등학교', region: '광주' };
const record = { id, recordDate: new Date(date), kind: 'LUNCH', revision: 1, note: '', items: [] };
const findMany = jest.fn<(query: unknown) => Promise<unknown[]>>();
const create = jest.fn<({ data }: { data: object }) => Promise<unknown>>(({ data }) =>
  Promise.resolve({ ...record, ...data }),
);
const deleteMany = jest
  .fn<(query: unknown) => Promise<{ count: number }>>()
  .mockResolvedValue({ count: 0 });
const neisMenus = jest
  .fn()
  .mockReturnValue([{ kind: 'LUNCH', items: ['쌀밥', '된장국'], mealKcal: 907.9 }]);
const neisSchools = jest.fn().mockReturnValue([school]);
const upsertSchool = jest.fn().mockReturnValue(school);
const updateMany = jest
  .fn<(query: unknown) => Promise<{ count: number }>>()
  .mockResolvedValue({ count: 1 });
const writeDay = jest.fn(
  (
    action: (tx: {
      mealRecord: {
        create: typeof create;
        updateMany: typeof updateMany;
        deleteMany: typeof deleteMany;
      };
    }) => Promise<void>,
  ) => action({ mealRecord: { create, updateMany, deleteMany } }),
);

const skipped = (kind: string) => ({ kind, skipped: true, items: [] });

/** A day where only lunch is eaten, so each test can focus on one meal's snapshot. */
function lunchDay(lunch: object = { items: [{ name: '  오므라이스  ' }] }) {
  return {
    requestId: randomUUID(),
    date,
    meals: [skipped('BREAKFAST'), { kind: 'LUNCH', ...lunch }, skipped('DINNER')],
  };
}

/** Items of the lunch record created by the last day save. */
function createdLunch() {
  const data = create.mock.calls
    .map(([query]) => query.data as { kind?: string; items?: unknown[] })
    .find(({ kind }) => kind === 'LUNCH');
  return data?.items;
}

describe('Meal records', () => {
  let app: INestApplication<Server>;
  const client = () => request(app.getHttpServer());
  const session = (test: request.Test) =>
    test.set('Cookie', `commit_health_session=${token}`).set('Origin', origin);
  const write = (test: request.Test) => session(test).set('X-CSRF-Token', csrf);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ NODE_ENV: 'test', FRONTEND_URL: origin, CORS_ORIGIN: origin }))
      .overrideProvider(AuthService)
      .useValue({
        resolveSession: (value: string) =>
          value === token ? { user: { id: userId }, csrfToken: csrf } : null,
      })
      .overrideProvider(PrismaService)
      .useValue({
        client: {
          mealRecord: { findMany },
          userSchool: { findUnique: () => Promise.resolve(school), upsert: upsertSchool },
          $transaction: writeDay,
        },
      })
      .overrideProvider(NeisService)
      .useValue({ menus: neisMenus, schools: neisSchools })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockReset().mockResolvedValue([]);
  });
  afterAll(() => app?.close());

  it('saves a full day in one transaction, with skipped meals and optional snacks', async () => {
    const payload = {
      requestId: randomUUID(),
      date,
      meals: [
        { kind: 'BREAKFAST', skipped: true, items: [] },
        { kind: 'LUNCH', items: [{ name: '김밥' }] },
        { kind: 'DINNER', items: [{ name: '비빔밥' }] },
      ],
    };
    await session(client().put(`${path}/day`))
      .send(payload)
      .expect(403);
    await write(client().put(`${path}/day`))
      .send({
        ...payload,
        meals: [payload.meals[0], payload.meals[1], { kind: 'DINNER', items: [] }],
      })
      .expect(400);
    expect(writeDay).not.toHaveBeenCalled();
    await write(client().put(`${path}/day`))
      .send(payload)
      .expect(204);
    expect(writeDay).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenCalledWith({
      data: {
        userId,
        recordDate: new Date(date),
        kind: 'BREAKFAST',
        items: [],
        requestId: payload.requestId,
      },
    });
    findMany.mockResolvedValue(
      payload.meals.map(({ kind }) => ({
        id: randomUUID(),
        kind,
        requestId: payload.requestId,
        revision: 1,
      })),
    );
    await write(client().put(`${path}/day`))
      .send(payload)
      .expect(204);
    expect(writeDay).toHaveBeenCalledTimes(1);
  });

  it('protects a saved day against edits prepared from stale records', async () => {
    findMany.mockResolvedValue([{ ...record, requestId: randomUUID(), revision: 2 }]);
    await write(client().put(`${path}/day`))
      .send({
        requestId: randomUUID(),
        date,
        meals: [
          { kind: 'BREAKFAST', skipped: true, items: [] },
          { kind: 'LUNCH', items: [{ name: '김밥' }], previous: { id, revision: 1 } },
          { kind: 'DINNER', skipped: true, items: [] },
        ],
      })
      .expect(409);
    expect(findMany).toHaveBeenCalledWith({ where: { userId, recordDate: new Date(date) } });
    expect(writeDay).not.toHaveBeenCalled();
  });

  it('requires a session and CSRF and rejects spoofed fields or an invalid date', async () => {
    await client().get(`${path}?date=${date}`).expect(401);
    await session(client().put(`${path}/day`))
      .send(lunchDay())
      .expect(403);
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ name: '밥', kcal: 123 }] }))
      .expect(400);
    await write(client().put(`${path}/day`))
      .send({ ...lunchDay(), date: '2023-02-29' })
      .expect(400);
    expect(writeDay).not.toHaveBeenCalled();
  });

  it('returns school suggestions and connects a selected school to the signed-in account', async () => {
    const url = `${path}/schools`;
    await client().get(url).query({ q: '테스트' }).expect(401);
    await session(client().get(url)).query({ q: '테스트 고' }).expect(200, [school]);
    expect(neisSchools).toHaveBeenCalledWith('테스트 고');

    const ref = { officeCode: school.officeCode, schoolCode: school.schoolCode };
    await session(client().put(`${path}/school`))
      .send(ref)
      .expect(403);
    await write(client().put(`${path}/school`))
      .send(ref)
      .expect(200, school);
    expect(upsertSchool).toHaveBeenCalledTimes(1);
    expect(upsertSchool).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId },
        create: { userId, ...school },
      }),
    );
    await session(client().get(`${path}/school/menus`))
      .query({ date })
      .expect(200, {
        school,
        meals: [{ kind: 'LUNCH', items: ['쌀밥', '된장국'], mealKcal: 907.9 }],
      });
  });

  it('saves trimmed names and refuses to overwrite a meal saved elsewhere', async () => {
    await write(client().put(`${path}/day`))
      .send(lunchDay())
      .expect(204);
    expect(createdLunch()).toMatchObject([{ name: '오므라이스', source: 'MANUAL' }]);

    jest.clearAllMocks();
    findMany.mockResolvedValue([{ ...record, requestId: randomUUID() }]);
    await write(client().put(`${path}/day`))
      .send(lunchDay())
      .expect(409);
    expect(writeDay).not.toHaveBeenCalled();
  });

  it('checks the catalog version and snapshots canonical nutrition reference values', async () => {
    const food = [...catalogById.values()].find(({ basis }) => basis === '100ml');
    if (!food) throw new Error('Expected a reference per 100ml');
    const items = [{ foodId: food.id }];
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items }))
      .expect(409);
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items, catalogVersion }))
      .expect(204);
    expect(createdLunch()).toMatchObject([
      { name: food.name, source: 'CATALOG', kcal: food.kcal, basis: '100ml', catalogVersion },
    ]);
  });

  it('keeps stored snapshots when editing and scopes the update to the previous revision', async () => {
    const savedId = randomUUID();
    const snapshot = {
      id: savedId,
      source: 'CATALOG',
      name: '이전 원자료 이름',
      kcal: 25,
      basis: '100g',
    };
    findMany.mockResolvedValue([{ ...record, requestId: randomUUID(), items: [snapshot] }]);
    const previous = { id, revision: 1 };
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ savedId: randomUUID() }], previous }))
      .expect(400);

    updateMany.mockResolvedValueOnce({ count: 0 });
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ savedId }], previous }))
      .expect(409);

    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ savedId }], previous }))
      .expect(204);
    expect(updateMany).toHaveBeenLastCalledWith({
      where: { userId, recordDate: new Date(date), kind: 'LUNCH', id, revision: 1 },
      data: expect.objectContaining({ items: [snapshot], revision: { increment: 1 } }),
    });
  });

  it('calculates energy using only the official basis and the submitted amount', async () => {
    const food = [...catalogById.values()].find((item) => item.basis === '100ml' && item.kcal > 0);
    if (!food) throw new Error('Expected a reference per 100ml');
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ foodId: food.id, amount: 0 }], catalogVersion }))
      .expect(400);
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ name: '밥', amount: 100 }] }))
      .expect(400);
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ foodId: food.id, amount: 125.5 }], catalogVersion }))
      .expect(204);
    expect(createdLunch()).toMatchObject([
      { basis: '100ml', amount: 125.5, energyKcal: Math.round(food.kcal * 125.5) / 100 },
    ]);
  });

  it('stores manual and verified 1-serving calories and leaves unknown values uncalculated', async () => {
    const foodId = 'food_46dc80385185483f';
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [{ foodId, portions: 1, kcalPerPortion: 100 }], catalogVersion }))
      .expect(400);
    await write(client().put(`${path}/day`))
      .send(
        lunchDay({
          items: [
            { foodId, portions: 0.5 },
            { name: '직접 입력', portions: 1.5, kcalPerPortion: 120 },
            { name: '열량 모름', portions: 1 },
          ],
          catalogVersion,
        }),
      )
      .expect(204);
    expect(createdLunch()).toMatchObject([
      { portions: 0.5, kcalPerPortion: 500.4, energyKcal: 250.2 },
      { portions: 1.5, kcalPerPortion: 120, energyKcal: 180 },
      { portions: 1, kcalPerPortion: null, energyKcal: null },
    ]);
  });

  it('records only the confirmed menu from the registered school', async () => {
    const ref = { officeCode: school.officeCode, schoolCode: school.schoolCode };
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [], school: { ...ref, schoolCode: '1234567', menu: ['쌀밥'] } }))
      .expect(409);
    expect(neisMenus).not.toHaveBeenCalled();
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [], school: { ...ref, menu: ['과거 메뉴'] } }))
      .expect(409);
    await write(client().put(`${path}/day`))
      .send(lunchDay({ items: [], school: { ...ref, menu: ['쌀밥', '된장국'] } }))
      .expect(204);
    expect(createdLunch()).toMatchObject([
      { source: 'SCHOOL', name: '쌀밥', schoolName: school.name, schoolMealKcal: 907.9 },
      { source: 'SCHOOL', name: '된장국', schoolName: school.name, schoolMealKcal: 907.9 },
    ]);
  });
});
