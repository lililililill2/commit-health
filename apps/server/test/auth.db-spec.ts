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
import { AuthService, hashToken } from '../src/modules/auth/auth.service.js';
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
    await app.init();
  });

  afterAll(async () => {
    if (databaseVerified && prisma) {
      await prisma.client.user.deleteMany({ where: { googleSub: { in: subjects } } });
      await prisma.client.oAuthAttempt.deleteMany({ where: { tokenHash: { in: [...attempts] } } });
    }
    if (app) await app.close();
    else await prisma?.onModuleDestroy();
  });

  async function start(agent: Agent) {
    const response = await agent.get('/api/auth/google').expect(303);
    attempts.add(hashToken(cookie(response, 'commit_health_oauth').split('=')[1]));
    return response.headers.location;
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
