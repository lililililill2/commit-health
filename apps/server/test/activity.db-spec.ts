import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { ActivityClock } from '../src/modules/activity/activity-clock.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { getTestDatabaseUrl } from './helpers/test-database.js';

describe('daily condition and foreground activity records', () => {
  let app: INestApplication<Server>,
    prisma: PrismaService,
    auth: AuthService,
    verified = false;
  let now = new Date();
  const subjects: string[] = [];
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
      .overrideProvider(ActivityClock)
      .useValue({ now: () => now })
      .compile();
    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get(AuthService);
    const [identity] = await prisma.client.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;
    if (identity.database !== 'commit_health_test')
      throw new Error('Not the dedicated test database');
    verified = true;
    app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  });
  beforeEach(() => {
    now = new Date('2026-11-11T03:00:00Z');
  });
  afterAll(async () => {
    if (verified) await prisma.client.user.deleteMany({ where: { googleSub: { in: subjects } } });
    if (app) await app.close();
    else await prisma?.onModuleDestroy();
  });
  async function identity() {
    const sub = `test_activity_${randomUUID()}`;
    subjects.push(sub);
    const token = await auth.login(sub),
      cookie = `commit_health_session=${token}`;
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
  type Who = Awaited<ReturnType<typeof identity>>;
  function write(who: Who, url: string, body: object = {}, method: 'post' | 'put' = 'post') {
    return request(app.getHttpServer())
      [method](url)
      .set('Cookie', who.cookie)
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', who.csrf)
      .send(body);
  }
  const read = (who: Who) =>
    request(app.getHttpServer()).get('/api/activity/today').set('Cookie', who.cookie);
  async function start(who: Who, kind: 'focus' | 'meditation' = 'focus') {
    const result = await write(who, '/api/activity/sessions', { kind }).expect(201);
    return (result.body as { id: string }).id;
  }
  const advance = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1_000);
  };

  it('requires authentication, CSRF, and no-store responses', async () => {
    await request(app.getHttpServer())
      .get('/api/activity/today')
      .expect('Cache-Control', 'no-store')
      .expect(401);
    const who = await identity();
    await request(app.getHttpServer())
      .post('/api/activity/sessions')
      .set('Cookie', who.cookie)
      .send({ kind: 'focus' })
      .expect(403);
    await read(who).expect('Cache-Control', 'no-store').expect(200);
  });
  it('saves and edits condition including both 0 and 100 on the current day', async () => {
    const who = await identity();
    for (const score of [0, 100, 42]) {
      const result = await write(
        who,
        '/api/activity/condition',
        { recordDate: '2026-11-11', score },
        'put',
      ).expect(200);
      expect(result.body).toMatchObject({ condition: { score } });
    }
    expect(await prisma.client.conditionRecord.count({ where: { userId: who.userId } })).toBe(1);
    expect((await read(who)).body).toMatchObject({ condition: { score: 42 } });
  });
  it('locks yesterday at Korean midnight and retains it when saving a new day', async () => {
    const who = await identity();
    await write(
      who,
      '/api/activity/condition',
      { recordDate: '2026-11-11', score: 40 },
      'put',
    ).expect(200);
    now = new Date('2026-11-11T15:00:00Z');
    await write(
      who,
      '/api/activity/condition',
      { recordDate: '2026-11-11', score: 90 },
      'put',
    ).expect(409);
    expect((await read(who)).body).toMatchObject({ recordDate: '2026-11-12', condition: null });
    await write(
      who,
      '/api/activity/condition',
      { recordDate: '2026-11-12', score: 80 },
      'put',
    ).expect(200);
    const previous = await prisma.client.conditionRecord.findUniqueOrThrow({
      where: { userId_recordDate: { userId: who.userId, recordDate: new Date('2026-11-11') } },
    });
    expect(previous.score).toBe(40);
  });
  it.each([-1, 101, 0.5, '50'])('rejects invalid condition score %s', async (score) => {
    const who = await identity();
    await write(who, '/api/activity/condition', { recordDate: '2026-11-11', score }, 'put').expect(
      400,
    );
  });
  it('isolates users and rejects client ownership or elapsed-time fields', async () => {
    const who = await identity(),
      other = await identity();
    await write(
      who,
      '/api/activity/condition',
      { recordDate: '2026-11-11', score: 70 },
      'put',
    ).expect(200);
    expect((await read(other)).body).toMatchObject({ condition: null });
    await write(
      other,
      '/api/activity/condition',
      { recordDate: '2026-11-11', score: 30, userId: who.userId },
      'put',
    ).expect(400);
    await write(who, '/api/activity/sessions', { kind: 'focus', durationSeconds: 999 }).expect(400);
    const id = await start(who);
    for (const action of ['heartbeat', 'complete', 'fail'])
      await write(other, `/api/activity/sessions/${id}/${action}`).expect(404);
  });
  it('uses server elapsed time and does not double-count repeated completions', async () => {
    const who = await identity(),
      id = await start(who);
    advance(10);
    await write(who, `/api/activity/sessions/${id}/heartbeat`).expect(201);
    advance(5);
    await write(who, `/api/activity/sessions/${id}/complete`, { durationSeconds: 999 }).expect(201);
    const result = await write(who, `/api/activity/sessions/${id}/complete`).expect(201);
    expect(result.body).toMatchObject({ focus: { count: 1, seconds: 15 } });
    await write(who, `/api/activity/sessions/${id}/fail`).expect(201);
    expect((await read(who)).body).toMatchObject({ focus: { count: 1, seconds: 15 } });
  });
  it('does not award an interrupted, stale, or previous-day session', async () => {
    const who = await identity();
    let id = await start(who);
    advance(5);
    await write(who, `/api/activity/sessions/${id}/fail`).expect(201);
    await write(who, `/api/activity/sessions/${id}/complete`).expect(409);
    id = await start(who);
    advance(15);
    await write(who, `/api/activity/sessions/${id}/heartbeat`).expect(409);
    await write(who, `/api/activity/sessions/${id}/complete`).expect(409);
    id = await start(who);
    now = new Date('2026-11-11T15:00:00Z');
    await write(who, `/api/activity/sessions/${id}/complete`).expect(409);
    expect((await read(who)).body).toMatchObject({ focus: { count: 0, seconds: 0 } });
  });
  it('requires the three-minute playback report and a live meditation session', async () => {
    const who = await identity(),
      id = await start(who, 'meditation');
    const path = `/api/activity/sessions/${id}/meditation-complete`;
    const evidence = { playedSeconds: 180 };
    await write(who, path, evidence).expect(400);
    for (let i = 0; i < 14; i++) {
      advance(12);
      await write(who, `/api/activity/sessions/${id}/heartbeat`).expect(201);
    }
    advance(11);
    await write(who, path, evidence).expect(400);
    advance(1);
    await write(who, path, { playedSeconds: 179 }).expect(400);
    const result = await write(who, path, evidence).expect(201);
    expect(result.body).toMatchObject({ meditation: { count: 1, seconds: 180 } });
    await write(who, path, evidence).expect(201);
    expect((await read(who)).body).toMatchObject({ meditation: { count: 1, seconds: 180 } });
  });
  it('allows only one concurrent session per user and replaces abandoned sessions only after expiry', async () => {
    const who = await identity();
    const responses = await Promise.all(
      Array.from({ length: 4 }, () => write(who, '/api/activity/sessions', { kind: 'focus' })),
    );
    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.status === 409)).toHaveLength(3);
    advance(15);
    await start(who, 'meditation');
    expect(
      await prisma.client.activitySession.count({
        where: { userId: who.userId, status: 'RUNNING' },
      }),
    ).toBe(1);
  });
  it('concurrent completion and failure leave one stable terminal outcome', async () => {
    const who = await identity(),
      id = await start(who);
    advance(5);
    await Promise.all([
      write(who, `/api/activity/sessions/${id}/complete`),
      write(who, `/api/activity/sessions/${id}/fail`),
    ]);
    const stored = await prisma.client.activitySession.findUniqueOrThrow({ where: { id } });
    const summary = (await read(who)).body as { focus: { count: number; seconds: number } };
    expect(summary.focus.count).toBe(stored.status === 'COMPLETED' ? 1 : 0);
    expect(summary.focus.seconds).toBe(stored.status === 'COMPLETED' ? 5 : 0);
  });
});
