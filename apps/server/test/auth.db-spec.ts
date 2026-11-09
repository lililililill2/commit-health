import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Controller, Get, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import type { Configuration } from 'openid-client';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { CurrentUser, type SessionUser } from '../src/auth/auth-context.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AuthService, hashToken, randomToken } from '../src/modules/auth/auth.service.js';
import { AuthCookies, MAX_OAUTH_ATTEMPTS } from '../src/modules/auth/auth-cookies.js';
import { GoogleOidcService } from '../src/modules/auth/google-oidc.service.js';
import { getTestDatabaseUrl } from './helpers/test-database.js';
import {
  TestOidcProvider,
  TEST_CALLBACK,
  TEST_CLIENT_ID,
  TEST_CLIENT_SECRET,
} from './helpers/oidc-provider.js';

class LocalGoogleService extends GoogleOidcService {
  constructor(
    config: ConfigService,
    private readonly provider: TestOidcProvider,
  ) {
    super(config);
  }
  protected getConfiguration(): Promise<Configuration> {
    return Promise.resolve(this.provider.configuration);
  }
}

@Controller('_auth-test')
class IdentityController {
  @Get('identity')
  identity(@CurrentUser() user: SessionUser): { id: string } {
    return { id: user.id };
  }
}

type Agent = ReturnType<typeof request.agent>;

describe('authentication with real PostgreSQL and a signed local OIDC provider', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let config: ConfigService;
  let provider: TestOidcProvider;
  let databaseVerified = false;
  const subjects: string[] = [];
  const attempts = new Set<string>();
  const newSub = () => {
    const sub = `test_oidc_${randomUUID()}`;
    subjects.push(sub);
    return sub;
  };
  const cookie = (response: { headers: Record<string, unknown> }, name: string): string => {
    const headers = response.headers['set-cookie'] as string[];
    return headers.find((value) => value.startsWith(`${name}=`))!.split(';')[0];
  };

  beforeAll(async () => {
    const databaseUrl = getTestDatabaseUrl();
    provider = new TestOidcProvider();
    config = new ConfigService({
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
      CORS_ORIGIN: 'http://localhost:3000',
      FRONTEND_URL: 'http://localhost:3000',
      COOKIE_SAME_SITE: 'lax',
      GOOGLE_CALLBACK_URL: TEST_CALLBACK,
      GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: TEST_CLIENT_SECRET,
    });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [IdentityController],
    })
      .overrideProvider(ConfigService)
      .useValue(config)
      .overrideProvider(GoogleOidcService)
      .useValue(new LocalGoogleService(config, provider))
      .compile();
    prisma = moduleRef.get(PrismaService);
    const [identity] = await prisma.client.$queryRaw<
      { database: string }[]
    >`SELECT current_database() AS database`;
    if (identity.database !== 'commit_health_test')
      throw new Error('Connected database is not commit_health_test');
    databaseVerified = true;
    app = moduleRef.createNestApplication<INestApplication<Server>>({ logger: false });
    configureApp(app);
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    if (databaseVerified && prisma) {
      await prisma.client.user.deleteMany({ where: { googleSub: { in: subjects } } });
      await prisma.client.oAuthAttempt.deleteMany({ where: { state: { in: [...attempts] } } });
    }
    if (app) await app.close();
    else await prisma?.onModuleDestroy();
  });

  async function startResponse(agent: Agent) {
    const response = await agent.get('/api/auth/google').expect(303);
    const state = new URL(response.headers.location).searchParams.get('state')!;
    attempts.add(state);
    return response;
  }
  async function start(agent: Agent) {
    return (await startResponse(agent)).headers.location;
  }
  async function login(agent: Agent, sub: string) {
    const callback = provider.callback(await start(agent), sub);
    const response = await agent
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/');
    return { callback, response, sessionCookie: cookie(response, 'commit_health_session') };
  }

  it('creates a user, restores the session, and persists only minimum user fields', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const loggedIn = await login(agent, sub);
    const user = await prisma.client.user.findUniqueOrThrow({ where: { googleSub: sub } });
    expect(Object.keys(user).sort()).toEqual(['createdAt', 'googleSub', 'id', 'updatedAt']);
    const me = await agent.get('/api/auth/me').expect(200).expect('Cache-Control', 'no-store');
    expect((me.body as { user: { id: string } }).user.id === user.id).toBe(true);
    expect(me.body).not.toHaveProperty('googleSub');
    expect(me.body).not.toHaveProperty('token');
    const otherPrisma = new PrismaService(config);
    try {
      const restored = await new AuthService(otherPrisma).resolveSession(
        loggedIn.sessionCookie.split('=')[1],
      );
      expect(restored?.user.id === user.id).toBe(true);
    } finally {
      await otherPrisma.onModuleDestroy();
    }
    await agent.get('/api/auth/me').expect(200);
    const setCookies = loggedIn.response.headers['set-cookie'] as unknown as string[];
    expect(
      setCookies.some((value) => value.includes('HttpOnly') && value.includes('SameSite=Lax')),
    ).toBe(true);
  });

  it('reuses the same user and rotates/revokes the old session on login', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const first = await login(agent, sub);
    await login(agent, sub);
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(1);
    await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', first.sessionCookie)
      .expect(401);
    await agent.get('/api/auth/me').expect(200);
  });

  it('prevents duplicate users under concurrent login', async () => {
    const sub = newSub();
    await Promise.all([1, 2, 3].map(() => app.get(AuthService).login(sub)));
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(1);
  });

  it.each([false, true])(
    'completes two login tabs independently with newestFirst=%s',
    async (newestFirst) => {
      const agent = request.agent(app.getHttpServer());
      const sub = newSub();
      const callbacks = [
        provider.callback(await start(agent), sub),
        provider.callback(await start(agent), sub),
      ];
      if (newestFirst) callbacks.reverse();
      for (const callback of callbacks) {
        const result = await agent
          .get(`${callback.pathname}${callback.search}`)
          .expect(303)
          .expect('Location', 'http://localhost:3000/');
        const cleared = (result.headers['set-cookie'] as unknown as string[]).filter((header) =>
          header.startsWith('commit_health_oauth_'),
        );
        expect(cleared).toHaveLength(0);
      }
      await agent.get('/api/auth/me').expect(200);
      expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(1);
    },
  );

  it('bounds repeated abandoned logins to one cookie and replaces only the oldest pending requests', async () => {
    const agent = request.agent(app.getHttpServer());
    const other = request.agent(app.getHttpServer());
    const otherCallback = provider.callback(await start(other), newSub());
    const urls: string[] = [];
    const bindings: string[] = [];
    const names = new Set<string>();
    const cookies = app.get(AuthCookies);
    for (let i = 0; i < MAX_OAUTH_ATTEMPTS * 3; i++) {
      const response = await startResponse(agent);
      urls.push(response.headers.location);
      bindings.push(cookie(response, cookies.attemptBrowserName));
      for (const header of response.headers['set-cookie'] as unknown as string[])
        names.add(header.split('=')[0]);
    }
    expect([...names]).toEqual([cookies.attemptBrowserName]);
    expect(bindings.every((value) => value === bindings[0])).toBe(true);
    expect(Buffer.byteLength(bindings[0])).toBeLessThan(128);
    const states = urls.map((url) => new URL(url).searchParams.get('state')!);
    expect(await prisma.client.oAuthAttempt.count({ where: { state: { in: states } } })).toBe(
      MAX_OAUTH_ATTEMPTS,
    );
    const evicted = provider.callback(urls[0], newSub());
    await agent
      .get(`${evicted.pathname}${evicted.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error');
    expect(await prisma.client.oAuthAttempt.count({ where: { state: { in: states } } })).toBe(
      MAX_OAUTH_ATTEMPTS,
    );
    const latest = provider.callback(urls[urls.length - 1], newSub());
    await agent
      .get(`${latest.pathname}${latest.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/');
    await other
      .get(`${otherCallback.pathname}${otherCallback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/');
  });

  it('enforces the pending limit across concurrent starts and keeps all surviving tabs usable', async () => {
    const agent = request.agent(app.getHttpServer());
    const first = await startResponse(agent);
    const binding = cookie(first, app.get(AuthCookies).attemptBrowserName);
    const urls: string[] = [first.headers.location];
    const responses = await Promise.all(
      Array.from({ length: MAX_OAUTH_ATTEMPTS * 2 }, () =>
        request(app.getHttpServer()).get('/api/auth/google').set('Cookie', binding).expect(303),
      ),
    );
    for (const response of responses) {
      const url = response.headers.location;
      urls.push(url);
      attempts.add(new URL(url).searchParams.get('state')!);
      expect(cookie(response, app.get(AuthCookies).attemptBrowserName) === binding).toBe(true);
    }
    const states = urls.map((url) => new URL(url).searchParams.get('state')!);
    const surviving = await prisma.client.oAuthAttempt.findMany({
      where: { state: { in: states } },
      select: { state: true },
    });
    expect(surviving).toHaveLength(MAX_OAUTH_ATTEMPTS);
    const sub = newSub();
    for (const { state } of surviving) {
      const callback = provider.callback(
        urls.find((url) => new URL(url).searchParams.get('state') === state)!,
        sub,
      );
      await agent
        .get(`${callback.pathname}${callback.search}`)
        .expect(303)
        .expect('Location', 'http://localhost:3000/');
    }
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(1);
    expect(await prisma.client.oAuthAttempt.count({ where: { state: { in: states } } })).toBe(0);
  });

  it('completes an in-flight login from the previous per-state cookie format', async () => {
    const start = await app.get(GoogleOidcService).begin();
    const token = randomToken();
    attempts.add(start.state);
    await prisma.client.oAuthAttempt.create({
      data: {
        tokenHash: hashToken(token),
        state: start.state,
        nonce: start.nonce,
        codeVerifier: start.codeVerifier,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const callback = provider.callback(start.url, newSub());
    const name = app.get(AuthCookies).attemptName(start.state);
    const response = await request(app.getHttpServer())
      .get(`${callback.pathname}${callback.search}`)
      .set('Cookie', `${name}=${token}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/');
    expect(
      (response.headers['set-cookie'] as unknown as string[]).some(
        (header) => header.startsWith(`${name}=`) && header.includes('Expires=Thu, 01 Jan 1970'),
      ),
    ).toBe(true);
  });

  it('does not let an expired old callback invalidate a newer login', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const old = provider.callback(await start(agent), sub);
    const latest = provider.callback(await start(agent), sub);
    await prisma.client.oAuthAttempt.updateMany({
      where: { state: old.searchParams.get('state')! },
      data: { expiresAt: new Date(0) },
    });
    await agent
      .get(`${old.pathname}${old.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error');
    expect(
      await prisma.client.oAuthAttempt.count({
        where: { state: latest.searchParams.get('state')! },
      }),
    ).toBe(1);
    await agent
      .get(`${latest.pathname}${latest.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/');
  });

  it('rejects concurrent callback replay before exchanging the same code twice', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const callback = provider.callback(await start(agent), sub);
    const before = provider.tokenRequests;
    const results = await Promise.all([
      agent.get(`${callback.pathname}${callback.search}`),
      agent.get(`${callback.pathname}${callback.search}`),
    ]);
    expect(results.map((result) => result.headers.location).sort()).toEqual([
      'http://localhost:3000/',
      'http://localhost:3000/auth/error',
    ]);
    expect(provider.tokenRequests).toBe(before + 1);
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(1);
  });

  it('requires a session and CSRF token for logout, then invalidates the session', async () => {
    const agent = request.agent(app.getHttpServer());
    const { sessionCookie } = await login(agent, newSub());
    const me = await agent.get('/api/auth/me').expect(200);
    const csrf = (me.body as { csrfToken: string }).csrfToken;
    await agent.post('/api/auth/logout').set('Origin', 'http://localhost:3000').expect(403);
    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrf).expect(403);
    await agent
      .post('/api/auth/logout')
      .set('Origin', 'https://attacker.invalid')
      .set('X-CSRF-Token', csrf)
      .expect(403);
    await agent
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:3000')
      .set('X-CSRF-Token', csrf)
      .expect(204);
    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', sessionCookie).expect(401);
  });

  it('rejects an expired session', async () => {
    const agent = request.agent(app.getHttpServer());
    const { sessionCookie } = await login(agent, newSub());
    await prisma.client.session.update({
      where: { tokenHash: hashToken(sessionCookie.split('=')[1]) },
      data: { expiresAt: new Date(0) },
    });
    await agent.get('/api/auth/me').expect(401);
  });

  it('blocks unauthenticated endpoints while keeping Health public', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    await request(app.getHttpServer()).get('/api/_auth-test/identity').expect(401);
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('derives ownership from the session instead of a supplied userId', async () => {
    const a = request.agent(app.getHttpServer());
    const b = request.agent(app.getHttpServer());
    await login(a, newSub());
    await login(b, newSub());
    const first = await a.get('/api/auth/me');
    const second = await b.get('/api/auth/me');
    const firstId = (first.body as { user: { id: string } }).user.id;
    const secondId = (second.body as { user: { id: string } }).user.id;
    const result = await a.get('/api/_auth-test/identity').query({ userId: secondId }).expect(200);
    expect((result.body as { id: string }).id === firstId).toBe(true);
    expect(firstId !== secondId).toBe(true);
  });

  it('binds OAuth state to the browser, consumes it once, and rejects replay', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const callback = provider.callback(await start(agent), sub);
    await request(app.getHttpServer())
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error');
    const other = request.agent(app.getHttpServer());
    await start(other);
    await other
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error');
    await agent
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/');
    await agent
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error');
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(1);
  });

  it('rejects forged state without creating a user or leaking the query in redirects', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const callback = provider.callback(await start(agent), sub);
    callback.searchParams.set('state', 'forged');
    await agent
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error')
      .expect('Referrer-Policy', 'no-referrer');
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(0);
  });

  it('does not persist a user when token verification fails', async () => {
    const agent = request.agent(app.getHttpServer());
    const sub = newSub();
    const callback = provider.callback(await start(agent), sub, { aud: 'another-client' });
    await agent
      .get(`${callback.pathname}${callback.search}`)
      .expect(303)
      .expect('Location', 'http://localhost:3000/auth/error');
    expect(await prisma.client.user.count({ where: { googleSub: sub } })).toBe(0);
  });
});
