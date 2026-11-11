import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import { type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { SleepClock } from '../src/modules/sleep/sleep-clock.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { getTestDatabaseUrl } from './helpers/test-database.js';

describe('immutable sleep records with real PostgreSQL', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let auth: AuthService;
  let verified = false;
  let now = new Date();
  const subjects: string[] = [];
  const input = { recordDate: '2026-11-10', bedtime: '23:00', wakeTime: '07:15' };

  beforeAll(async () => {
    const config = new ConfigService({
      DATABASE_URL: getTestDatabaseUrl(),
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:3000',
      CORS_ORIGIN: 'http://localhost:3000',
      COOKIE_SAME_SITE: 'lax',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(SleepClock)
      .useValue({ now: () => now })
      .compile();
    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get(AuthService);
    const [identity] = await prisma.client.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;
    if (identity.database !== 'commit_health_test') throw new Error('Refusing a non-test database');
    verified = true;
    app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(() => {
    now = new Date('2026-11-10T03:00:00Z');
  });

  afterAll(async () => {
    if (verified) await prisma.client.user.deleteMany({ where: { googleSub: { in: subjects } } });
    if (app) await app.close();
    else await prisma?.onModuleDestroy();
  });

  async function identity() {
    const sub = `test_sleep_${randomUUID()}`;
    subjects.push(sub);
    const token = await auth.login(sub);
    const cookie = `commit_health_session=${token}`;
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    return {
      cookie,
      csrf: (me.body as { csrfToken: string }).csrfToken,
      userId: (me.body as { user: { id: string } }).user.id,
    };
  }

  function post(who: Awaited<ReturnType<typeof identity>>, body: object = input) {
    return request(app.getHttpServer())
      .post('/api/sleep')
      .set('Cookie', who.cookie)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', who.csrf)
      .send(body);
  }

  it('blocks unauthenticated reads and writes and does not cache failures', async () => {
    await request(app.getHttpServer())
      .get('/api/sleep/today')
      .expect('Cache-Control', 'no-store')
      .expect(401);
    await request(app.getHttpServer()).post('/api/sleep').send(input).expect(401);
  });

  it('requires the session CSRF token and approved Origin', async () => {
    const who = await identity();
    await request(app.getHttpServer())
      .post('/api/sleep')
      .set('Cookie', who.cookie)
      .send(input)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/sleep')
      .set('Cookie', who.cookie)
      .set('Origin', 'https://unapproved.example')
      .set('X-CSRF-Token', who.csrf)
      .send(input)
      .expect(403);
  });

  it('persists the derived overnight duration and restores the completed record', async () => {
    const who = await identity();
    const before = await request(app.getHttpServer())
      .get('/api/sleep/today')
      .set('Cookie', who.cookie)
      .expect(200);
    expect(before.body).toMatchObject({ recordDate: input.recordDate, record: null });
    const created = await post(who).expect('Cache-Control', 'no-store').expect(201);
    expect(created.body).toMatchObject({
      recordDate: input.recordDate,
      record: {
        recordDate: input.recordDate,
        bedtime: '2026-11-09T14:00:00.000Z',
        wakeTime: '2026-11-09T22:15:00.000Z',
        durationMinutes: 495,
      },
    });
    expect((created.body as { record: object }).record).not.toHaveProperty('userId');
    const restored = await request(app.getHttpServer())
      .get('/api/sleep/today')
      .set('Cookie', who.cookie)
      .expect(200);
    expect(restored.body).toEqual(created.body);
    expect(await prisma.client.sleepRecord.count({ where: { userId: who.userId } })).toBe(1);
  });

  it('rejects edits and a second confirmation without changing the first record', async () => {
    const who = await identity();
    const first = await post(who).expect(201);
    await post(who, { ...input, wakeTime: '08:00' }).expect(409);
    for (const method of ['patch', 'put', 'delete'] as const)
      await request(app.getHttpServer())
        [method]('/api/sleep')
        .set('Cookie', who.cookie)
        .set('Origin', 'http://localhost:3000')
        .set('X-CSRF-Token', who.csrf)
        .send(input)
        .expect(404);
    const restored = await request(app.getHttpServer())
      .get('/api/sleep/today')
      .set('Cookie', who.cookie)
      .expect(200);
    expect(restored.body).toEqual(first.body);
  });

  it('allows only one of eight simultaneous confirmations', async () => {
    const who = await identity();
    const responses = await Promise.all(Array.from({ length: 8 }, () => post(who)));
    expect(responses.filter((result) => result.status === 201)).toHaveLength(1);
    expect(responses.filter((result) => result.status === 409)).toHaveLength(7);
    expect(await prisma.client.sleepRecord.count({ where: { userId: who.userId } })).toBe(1);
  });

  it('keeps users isolated and rejects supplied ownership or duration fields', async () => {
    const first = await identity();
    const other = await identity();
    await post(first).expect(201);
    const own = await request(app.getHttpServer())
      .get('/api/sleep/today')
      .set('Cookie', other.cookie)
      .expect(200);
    expect(own.body).toMatchObject({ record: null });
    await post(other, { ...input, userId: first.userId }).expect(400);
    await post(other, { ...input, durationMinutes: 999 }).expect(400);
    await post(other).expect(201);
    expect(await prisma.client.sleepRecord.count({ where: { userId: other.userId } })).toBe(1);
  });

  it.each([
    { ...input, bedtime: '23:01' },
    { ...input, wakeTime: '24:00' },
    { ...input, bedtime: '07:15' },
    { ...input, wakeTime: '12:15' },
  ])('rejects invalid, equal or future times %#', async (body) => {
    const who = await identity();
    await post(who, body).expect(400);
    expect(await prisma.client.sleepRecord.count({ where: { userId: who.userId } })).toBe(0);
  });

  it('locks the old date at Korean midnight and allows a new day without losing history', async () => {
    const who = await identity();
    await post(who).expect(201);
    now = new Date('2026-11-10T15:00:00Z');
    const next = await request(app.getHttpServer())
      .get('/api/sleep/today')
      .set('Cookie', who.cookie)
      .expect(200);
    expect(next.body).toMatchObject({ recordDate: '2026-11-11', record: null });
    await post(who).expect(409);
    await post(who, { recordDate: '2026-11-11', bedtime: '23:00', wakeTime: '00:00' }).expect(201);
    expect(await prisma.client.sleepRecord.count({ where: { userId: who.userId } })).toBe(2);
  });
});
