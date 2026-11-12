import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';

import type { OAuthAttempt, Session } from '../../generated/prisma/client.js';
import type { SessionUser } from '../../auth/auth-context.js';
import type { PrismaService } from '../../prisma/prisma.service.js';
import { AuthService, hashToken, randomToken } from './auth.service.js';

describe('OAuth attempt consumption', () => {
  const token = randomToken();
  const state = randomToken();
  let attempt: OAuthAttempt;
  const findFirst = jest.fn<(query: unknown) => Promise<OAuthAttempt | null>>();
  const deleteMany = jest.fn<(query: unknown) => Promise<{ count: number }>>();
  let service: AuthService;

  beforeEach(() => {
    jest.resetAllMocks();
    attempt = {
      tokenHash: hashToken(token),
      state,
      nonce: randomToken(),
      codeVerifier: randomToken(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    findFirst.mockResolvedValue(attempt);
    deleteMany.mockResolvedValue({ count: 1 });
    service = new AuthService({
      client: { oAuthAttempt: { findFirst, deleteMany } },
    } as unknown as PrismaService);
  });

  it('does not consume a request when its state does not match the browser token', async () => {
    await expect(service.consumeAttempt(token, randomToken())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('rejects missing tokens and expired attempts', async () => {
    await expect(service.consumeAttempt(undefined, state)).rejects.toThrow(UnauthorizedException);
    expect(findFirst).not.toHaveBeenCalled();
    findFirst.mockResolvedValue({ ...attempt, expiresAt: new Date(0) });
    await expect(service.consumeAttempt(token, state)).rejects.toThrow(UnauthorizedException);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it('atomically consumes only the matching unexpired request', async () => {
    await expect(service.consumeAttempt(token, state)).resolves.toEqual(attempt);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(token), state, expiresAt: { gt: expect.any(Date) } },
    });
  });

  it('allows only one concurrent consumer even when both read the same attempt', async () => {
    deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const results = await Promise.allSettled([
      service.consumeAttempt(token, state),
      service.consumeAttempt(token, state),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});

describe('24-hour inactivity sessions', () => {
  const day = 86_400_000;
  const now = Date.UTC(2026, 10, 12, 3);
  const token = randomToken();
  const user: SessionUser = {
    id: 'test-user',
    createdAt: new Date(now),
    updatedAt: new Date(now),
  };
  let session: Session & { user: SessionUser };
  const findUnique = jest.fn<(query: unknown) => Promise<typeof session | null>>();
  const deleteMany = jest.fn<(query: unknown) => Promise<{ count: number }>>();
  const updateMany = jest.fn<(query: unknown) => Promise<{ count: number }>>();
  let service: AuthService;

  beforeEach(() => {
    findUnique.mockReset();
    deleteMany.mockReset().mockResolvedValue({ count: 1 });
    updateMany.mockReset().mockResolvedValue({ count: 1 });
    jest.spyOn(Date, 'now').mockReturnValue(now);
    session = {
      tokenHash: hashToken(token),
      userId: user.id,
      csrfToken: randomToken(),
      createdAt: new Date(now - 3 * day),
      expiresAt: new Date(now + day),
      user,
    };
    findUnique.mockResolvedValue(session);
    service = new AuthService({
      client: { session: { findUnique, deleteMany, updateMany } },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('issues new database sessions with a 24-hour expiry', async () => {
    const create = jest.fn<(query: unknown) => Promise<void>>().mockResolvedValue(undefined);
    const tx = {
      user: { upsert: () => Promise.resolve({ id: user.id }) },
      session: { deleteMany, create },
    };
    const loginService = new AuthService({
      client: { $transaction: async (action: (client: typeof tx) => Promise<void>) => action(tx) },
    } as unknown as PrismaService);

    await loginService.login('test-google-sub');

    const saved = create.mock.calls[0][0] as { data: { expiresAt: Date } };
    expect(saved.data.expiresAt.getTime() - now).toBe(day);
  });

  it.each([
    { age: day - 1, valid: true },
    { age: day, valid: false },
    { age: day + 1, valid: false },
  ])(
    'checks the idle deadline after $age ms regardless of the original login date',
    async ({ age, valid }) => {
      jest.mocked(Date.now).mockReturnValue(now + age);

      const resolved = await service.resolveSession(token);

      expect(resolved !== null).toBe(valid);
      expect(deleteMany).toHaveBeenCalledTimes(valid ? 0 : 1);
    },
  );

  it('continues to reject a stored expiry earlier than the 24-hour limit', async () => {
    session.expiresAt = new Date(now - 1);

    expect(await service.resolveSession(token)).toBeNull();
    expect(deleteMany).toHaveBeenCalledTimes(1);
  });

  it('does not extend the session lifetime for passive session checks', async () => {
    session.expiresAt = new Date(now + day);
    for (const age of [60 * 60 * 1_000, 2 * 60 * 60 * 1_000]) {
      jest.mocked(Date.now).mockReturnValue(now + age);
      expect((await service.resolveSession(token))?.user.id).toBe(user.id);
    }
    expect(session.expiresAt.getTime()).toBe(now + day);
    expect(deleteMany).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('renews on activity and keeps a session valid beyond the original 24-hour deadline', async () => {
    jest.mocked(Date.now).mockReturnValue(now + 18 * 60 * 60 * 1_000);
    expect(await service.renewSession(session.tokenHash)).toBe(true);
    const saved = updateMany.mock.calls[0][0] as {
      where: { expiresAt: { gt: Date } };
      data: { expiresAt: Date };
    };
    expect(saved.data.expiresAt.getTime() - Date.now()).toBe(day);
    expect(saved.where.expiresAt.gt.getTime()).toBe(Date.now());
    session.expiresAt = saved.data.expiresAt;
    jest.mocked(Date.now).mockReturnValue(now + day + 1);
    expect((await service.resolveSession(token))?.user.id).toBe(user.id);
    jest.mocked(Date.now).mockReturnValue(session.expiresAt.getTime());
    expect(await service.resolveSession(token)).toBeNull();
  });

  it('does not recreate an expired or revoked session during renewal', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    expect(await service.renewSession(session.tokenHash)).toBe(false);
  });

  it('does not query the database for a missing session cookie', async () => {
    expect(await service.resolveSession()).toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
