import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { koreanDay } from '../src/common/korean-day.js';
import { configureApp } from '../src/config/configure-app.js';
import { Prisma } from '../src/generated/prisma/client.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const url = '/api/caffeine';
const origin = 'http://localhost:3000';
const sessionToken = 'a'.repeat(43);
const csrfToken = 'b'.repeat(43);
const userId = 'session-user';
const recordId = 'f4f628e2-8bee-4adb-9cf2-7a83224af879';
const catalogId = 'hot6-zero-250';
const today = () => koreanDay(new Date()).recordDate;

const records = {
  findMany: jest.fn<(args: unknown) => Promise<unknown[]>>().mockResolvedValue([]),
  create: jest.fn<(args: unknown) => Promise<unknown>>().mockResolvedValue({}),
  updateMany: jest
    .fn<(args: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 }),
  deleteMany: jest
    .fn<(args: unknown) => Promise<{ count: number }>>()
    .mockResolvedValue({ count: 1 }),
};

describe('Caffeine records', () => {
  let app: INestApplication<Server>;
  const client = () => request(app.getHttpServer());
  const session = (test: request.Test) =>
    test.set('Cookie', `commit_health_session=${sessionToken}`).set('Origin', origin);
  const write = (test: request.Test) => session(test).set('X-CSRF-Token', csrfToken);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ NODE_ENV: 'test', CORS_ORIGIN: origin, FRONTEND_URL: origin }))
      .overrideProvider(PrismaService)
      .useValue({ client: { caffeineRecord: records } })
      .overrideProvider(AuthService)
      .useValue({
        resolveSession: (token?: string) =>
          token === sessionToken ? { user: { id: userId }, csrfToken } : null,
      })
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(() => app?.close());

  it('protects reads and requires CSRF on writes', async () => {
    await client().get(`${url}/today`).expect(401);
    await session(client().post(url)).send({ recordDate: today(), catalogId }).expect(403);
    expect(records.create).not.toHaveBeenCalled();
  });

  it('uses the selected serving from the catalog and rejects overrides', async () => {
    const date = today();
    const response = await session(client().get(`${url}/catalog`))
      .expect(200)
      .expect('Cache-Control', 'no-store');
    const products = response.body as { id: string; caffeineMg: number }[];
    expect(products).toContainEqual(expect.objectContaining({ id: catalogId, caffeineMg: 70 }));
    expect(products.every((product) => product.caffeineMg >= 70)).toBe(true);
    await write(client().post(url))
      .send({ recordDate: date, catalogId, caffeineMg: 1 })
      .expect(400);
    await write(client().post(url)).send({ recordDate: date, catalogId: 'unknown' }).expect(400);
    await write(client().post(url))
      .send({ recordDate: date, catalogId: 'red-bull-original-250' })
      .expect(400);
    await write(client().post(url)).send({ recordDate: date, catalogId }).expect(204);
    expect(records.create).toHaveBeenCalledTimes(1);
    expect(records.create).toHaveBeenCalledWith({
      data: {
        userId,
        recordDate: new Date(date),
        catalogId,
        drinkName: '핫식스 제로',
        servingLabel: '1캔 · 250 mL',
        caffeineMg: new Prisma.Decimal(70),
        consumedAt: expect.any(Date),
      },
    });
  });

  it('validates manual amounts and sums fractional records for the session user', async () => {
    const base = { recordDate: today(), drinkName: ' 직접 입력 음료 ' };
    await write(client().post(url))
      .send({ ...base, caffeineMg: 1e-7 })
      .expect(400);
    await write(client().post(url))
      .send({ ...base, caffeineMg: -1 })
      .expect(400);
    await write(client().post(url))
      .send({ ...base, caffeineMg: null })
      .expect(400);
    await write(client().post(url))
      .send({ ...base, caffeineMg: 0.2 })
      .expect(204);
    expect(records.create).toHaveBeenCalledWith({
      data: {
        userId,
        recordDate: new Date(base.recordDate),
        catalogId: null,
        drinkName: '직접 입력 음료',
        servingLabel: null,
        caffeineMg: new Prisma.Decimal(0.2),
        consumedAt: expect.any(Date),
      },
    });

    const consumedAt = new Date(`${base.recordDate}T00:00:00+09:00`);
    records.findMany.mockResolvedValueOnce([
      { id: recordId, drinkName: '첫 음료', caffeineMg: new Prisma.Decimal(0.1), consumedAt },
      { id: 'second', drinkName: '둘째 음료', caffeineMg: new Prisma.Decimal(0.2), consumedAt },
    ]);
    const response = await session(client().get(`${url}/today`)).expect(200);
    const body: unknown = response.body;
    expect(body).toMatchObject({ recordDate: base.recordDate, totalMg: 0.3 });
    expect(records.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId, recordDate: new Date(base.recordDate) } }),
    );
  });

  it('refuses previous dates and scopes updates and deletions to the owner and current date', async () => {
    const date = today();
    await write(client().put(`${url}/${recordId}`))
      .send({ recordDate: '2000-01-01', catalogId })
      .expect(409);
    await write(client().delete(`${url}/${recordId}/2000-01-01`)).expect(409);
    expect(records.updateMany).not.toHaveBeenCalled();
    expect(records.deleteMany).not.toHaveBeenCalled();

    records.updateMany.mockResolvedValueOnce({ count: 0 });
    records.deleteMany.mockResolvedValueOnce({ count: 0 });
    await write(client().put(`${url}/${recordId}`))
      .send({ recordDate: date, catalogId })
      .expect(404);
    await write(client().delete(`${url}/${recordId}/${date}`)).expect(404);
    await write(client().put(`${url}/${recordId}`))
      .send({ recordDate: date, catalogId })
      .expect(204);
    await write(client().delete(`${url}/${recordId}/${date}`)).expect(204);
    const where = { id: recordId, userId, recordDate: new Date(date) };
    expect(records.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(records.deleteMany).toHaveBeenCalledWith({ where });
  });
});
