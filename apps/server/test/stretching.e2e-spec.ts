import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'node:http';
import request from 'supertest';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { ActivityClock } from '../src/modules/activity/activity-clock.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const origin = 'http://localhost:3000';
const id = 'f4f628e2-8bee-4adb-9cf2-7a83224af879';
const owner = 'owner';
const path = `/api/activity/sessions/${id}/stretching-complete`;
const good = { leftMs: 10_000, rightMs: 10_000 };
const csrfToken = 'c'.repeat(43);
const start = Date.parse('2026-11-23T11:00:00.000Z');
let now: Date;
let completed: boolean;
let kind: 'SHOULDER_CROSS_BODY' | 'MEDITATION';

const sessions = {
  create: jest.fn(({ data }: { data: { kind: 'SHOULDER_CROSS_BODY'; startedAt: Date } }) => ({
    ...data,
    id,
    status: 'RUNNING',
    durationSeconds: 0,
  })),
  findFirst: jest.fn(({ where }: { where: { id?: string; userId: string } }) => {
    if (where.id !== id || where.userId !== owner) return null;
    return {
      id,
      userId: owner,
      kind,
      status: completed ? 'COMPLETED' : 'RUNNING',
      recordDate: new Date('2026-11-23'),
      startedAt: new Date(start),
      lastSeenAt: new Date(start + 18_000),
    };
  }),
  updateMany: jest.fn(({ where }: { where: { id?: string; userId: string }; data: unknown }) => {
    if (where.id !== id || where.userId !== owner || completed) return { count: 0 };
    completed = true;
    return { count: 1 };
  }),
  groupBy: jest.fn(() =>
    completed ? [{ kind, _count: { _all: 1 }, _sum: { durationSeconds: 20 } }] : [],
  ),
};
const transaction = { activitySession: sessions, $queryRaw: () => [] };

describe('Stretching completion', () => {
  let app: INestApplication<Server>;
  const client = () => request(app.getHttpServer());
  const authenticate = (test: request.Test, user = 'a') =>
    test.set('Origin', origin).set('Cookie', `commit_health_session=${user.repeat(43)}`);
  const write = (test: request.Test, user = 'a') =>
    authenticate(test, user).set('X-CSRF-Token', csrfToken);

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ NODE_ENV: 'test', CORS_ORIGIN: origin, FRONTEND_URL: origin }))
      .overrideProvider(PrismaService)
      .useValue({
        client: {
          activitySession: sessions,
          conditionRecord: { findUnique: () => null },
          $transaction: (work: (tx: typeof transaction) => unknown) => work(transaction),
        },
      })
      .overrideProvider(ActivityClock)
      .useValue({ now: () => now })
      .overrideProvider(AuthService)
      .useValue({
        resolveSession: (token?: string) =>
          token === 'a'.repeat(43)
            ? { user: { id: owner }, csrfToken }
            : token === 'b'.repeat(43)
              ? { user: { id: 'other' }, csrfToken }
              : null,
      })
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    now = new Date(start + 22_000);
    completed = false;
    kind = 'SHOULDER_CROSS_BODY';
    jest.clearAllMocks();
  });

  afterAll(() => app?.close());

  it('accepts the shoulder stretching kind and creates an owned running session', async () => {
    const response = await write(client().post('/api/activity/sessions'))
      .send({ kind: 'shoulder-cross-body' })
      .expect(201);
    const body: unknown = response.body;
    expect(body).toMatchObject({ id, kind: 'shoulder-cross-body', status: 'running' });
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: owner, kind: 'SHOULDER_CROSS_BODY' }),
      }),
    );
  });

  it('requires a valid session, CSRF, and ownership', async () => {
    await client().post(path).send(good).expect(401);
    await authenticate(client().post(path)).send(good).expect(403);
    await write(client().post(path), 'b').send(good).expect(404);
    expect(completed).toBe(false);
  });

  it('rejects short evidence, early completion, and the wrong completion route or activity', async () => {
    await write(client().post(path)).send({ leftMs: 9_999, rightMs: 10_000 }).expect(400);
    await write(client().post(path)).send({ leftMs: 10_000 }).expect(400);
    await write(client().post(`/api/activity/sessions/${id}/complete`))
      .send({})
      .expect(400);
    now = new Date(start + 19_999);
    await write(client().post(path)).send(good).expect(400);
    kind = 'MEDITATION';
    await write(client().post(path)).send(good).expect(400);
    expect(completed).toBe(false);
  });

  it('expires a stopped session instead of saving it', async () => {
    now = new Date(start + 33_001);
    await write(client().post(path)).send(good).expect(409);
    expect(sessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('stores 20 seconds once and returns the day summary when completion is repeated', async () => {
    const responses = await Promise.all([
      write(client().post(path)).send(good).expect(201),
      write(client().post(path)).send(good).expect(201),
    ]);
    for (const response of responses) {
      const body: unknown = response.body;
      expect(body).toMatchObject({ stretching: { count: 1, seconds: 20 } });
    }
    const stored = sessions.updateMany.mock.results.filter(
      (result) => result.type === 'return' && result.value.count === 1,
    );
    expect(stored).toHaveLength(1);
    expect(sessions.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'COMPLETED', durationSeconds: 20 }),
      }),
    );
  });
});
