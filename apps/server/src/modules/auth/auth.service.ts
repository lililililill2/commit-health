import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedSession } from '../../auth/auth-context.js';
import { MAX_OAUTH_ATTEMPTS, OAUTH_TTL_MS, SESSION_TTL_MS } from './auth-cookies.js';

export const randomToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export function equalToken(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function attemptSlots(browserToken: string): string[] {
  return Array.from({ length: MAX_OAUTH_ATTEMPTS }, (_, slot) =>
    createHmac('sha256', browserToken).update(`commit-health:oauth-attempt:${slot}`).digest('hex'),
  );
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createAttempt(
    state: string,
    nonce: string,
    codeVerifier: string,
    browserToken: string,
  ): Promise<void> {
    const slots = attemptSlots(browserToken);
    const lock = createHash('sha256')
      .update(`oauth-attempt:${browserToken}`)
      .digest()
      .readBigInt64BE();
    await this.prisma.client.$transaction(async (tx) => {
      // Fixed browser-bound keys cap rows without a schema change; the transaction lock
      // prevents simultaneous login starts from overwriting the same free slot.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lock}::bigint)::text`;
      await tx.oAuthAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
      const pending = await tx.oAuthAttempt.findMany({
        where: { tokenHash: { in: slots } },
        orderBy: [{ expiresAt: 'asc' }, { tokenHash: 'asc' }],
        select: { tokenHash: true },
      });
      const occupied = new Set(pending.map((attempt) => attempt.tokenHash));
      const tokenHash = slots.find((slot) => !occupied.has(slot)) ?? pending[0].tokenHash;
      const data = { state, nonce, codeVerifier, expiresAt: new Date(Date.now() + OAUTH_TTL_MS) };
      await tx.oAuthAttempt.upsert({
        where: { tokenHash },
        create: { tokenHash, ...data },
        update: data,
      });
    });
  }

  async consumeAttempt(token: string | undefined, state: string) {
    if (!token || !state) throw new UnauthorizedException('Invalid OAuth response');
    const attempt = await this.prisma.client.oAuthAttempt.findFirst({
      // The first key supports existing per-state cookies during the release transition.
      where: { tokenHash: { in: [hashToken(token), ...attemptSlots(token)] }, state },
    });
    if (!attempt || !equalToken(state, attempt.state) || attempt.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid OAuth response');
    const removed = await this.prisma.client.oAuthAttempt.deleteMany({
      where: { tokenHash: attempt.tokenHash, state: attempt.state, expiresAt: { gt: new Date() } },
    });
    if (removed.count !== 1) throw new UnauthorizedException('Invalid OAuth response');
    return attempt;
  }

  async login(googleSub: string, previousToken?: string): Promise<string> {
    if (!googleSub || googleSub.length > 255) throw new UnauthorizedException('Invalid identity');
    const token = randomToken();
    await this.prisma.client.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { googleSub },
        create: { googleSub },
        update: { googleSub },
        select: { id: true },
      });
      await tx.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: new Date() } },
            ...(previousToken ? [{ tokenHash: hashToken(previousToken) }] : []),
          ],
        },
      });
      await tx.session.create({
        data: {
          tokenHash: hashToken(token),
          csrfToken: randomToken(),
          userId: user.id,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      });
    });
    return token;
  }

  async resolveSession(token?: string): Promise<AuthenticatedSession | null> {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await this.prisma.client.session.findUnique({
      where: { tokenHash },
      include: {
        user: { select: { id: true, createdAt: true, updatedAt: true } },
      },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.client.session.deleteMany({ where: { tokenHash } });
      return null;
    }
    return { tokenHash, csrfToken: session.csrfToken, user: session.user };
  }

  async renewSession(tokenHash: string): Promise<boolean> {
    const now = Date.now();
    const renewed = await this.prisma.client.session.updateMany({
      where: { tokenHash, expiresAt: { gt: new Date(now) } },
      data: { expiresAt: new Date(now + SESSION_TTL_MS) },
    });
    return renewed.count === 1;
  }

  async logout(tokenHash: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { tokenHash } });
  }
}
