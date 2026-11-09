import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';

import type { OAuthAttempt } from '../../generated/prisma/client.js';
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
