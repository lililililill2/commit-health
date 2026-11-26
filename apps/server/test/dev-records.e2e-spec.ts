import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterAll, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const localOrigin = 'http://localhost:3000';
const userId = 'test-user';
const sessionToken = 'a'.repeat(43);
const csrfToken = 'b'.repeat(43);
const koreanDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' });
const currentDate = () => koreanDate.format(new Date());
const endpoint = (date = currentDate()) => `/api/dev/records/today/${date}`;
const mockDelete = () =>
  jest.fn<(filter: { where: { userId: string; recordDate: Date } }) => Promise<{ count: number }>>(
    () => Promise.resolve({ count: 0 }),
  );
const deleteRecords = {
  sleepRecord: { deleteMany: mockDelete() },
  conditionRecord: { deleteMany: mockDelete() },
  activitySession: { deleteMany: mockDelete() },
  caffeineRecord: { deleteMany: mockDelete() },
  caffeineFreeDay: { deleteMany: mockDelete() },
  mealRecord: { deleteMany: mockDelete() },
};
const transaction = jest.fn((writes: Promise<unknown>[]) => Promise.all(writes));

async function createApp(environment: string, origin = localOrigin) {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService({ NODE_ENV: environment, FRONTEND_URL: origin, CORS_ORIGIN: origin }),
    )
    .overrideProvider(PrismaService)
    .useValue({ client: { ...deleteRecords, $transaction: transaction } })
    .overrideProvider(AuthService)
    .useValue({
      resolveSession: (token?: string) =>
        token === sessionToken ? { user: { id: userId }, csrfToken } : null,
    })
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<Server>>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Development record reset', () => {
  let development: INestApplication<Server>;

  beforeAll(async () => {
    development = await createApp('development');
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterAll(async () => {
    await development?.close();
  });

  it('requires a session and checks CSRF and origin before deleting', async () => {
    const client = request(development.getHttpServer());
    await client
      .options(endpoint())
      .set('Origin', localOrigin)
      .set('Access-Control-Request-Method', 'DELETE')
      .set('Access-Control-Request-Headers', 'x-csrf-token')
      .expect('Access-Control-Allow-Methods', /DELETE/)
      .expect('Access-Control-Allow-Headers', /x-csrf-token/i)
      .expect(204);
    await client.delete(endpoint()).set('Origin', localOrigin).expect(401);
    await client
      .delete(endpoint())
      .set('Origin', localOrigin)
      .set('Cookie', `commit_health_session=${sessionToken}`)
      .expect(403);
    await client
      .delete(endpoint())
      .set('Origin', 'http://example.test')
      .set('Cookie', `commit_health_session=${sessionToken}`)
      .set('X-CSRF-Token', csrfToken)
      .expect(403);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects an old date and deletes only the confirmed Korean day for the session user', async () => {
    const client = request(development.getHttpServer());
    const reset = (date: string) =>
      client
        .delete(endpoint(date))
        .set('Origin', localOrigin)
        .set('Cookie', `commit_health_session=${sessionToken}`)
        .set('X-CSRF-Token', csrfToken);

    await reset('2000-01-01').expect(409);
    expect(transaction).not.toHaveBeenCalled();
    const date = currentDate();
    await reset(date).send({ userId: 'different-user' }).expect(204);
    expect(transaction).toHaveBeenCalledTimes(1);
    for (const model of Object.values(deleteRecords)) {
      expect(model.deleteMany).toHaveBeenCalledTimes(1);
      expect(model.deleteMany).toHaveBeenCalledWith({
        where: { userId, recordDate: new Date(date) },
      });
    }
  });

  it.each([
    ['production', localOrigin, '__Host-commit_health_session'],
    ['development', 'https://example.test', 'commit_health_session'],
  ])('blocks reset in %s with frontend %s', async (environment, origin, cookie) => {
    const app = await createApp(environment, origin);
    try {
      await request(app.getHttpServer())
        .delete(endpoint())
        .set('Origin', origin)
        .set('Cookie', `${cookie}=${sessionToken}`)
        .set('X-CSRF-Token', csrfToken)
        .expect(404);
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
