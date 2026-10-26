import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedSession } from '../../auth/auth-context.js';
import { OAUTH_TTL_MS, SESSION_TTL_MS } from './auth-cookies.js';

export const randomToken = (): string => randomBytes(32).toString('base64url');
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');
export function equalToken(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createAttempt(
    state: string,
    nonce: string,
    codeVerifier: string,
    previous?: string,
  ): Promise<string> {
    const token = randomToken();
    await this.prisma.client.oAuthAttempt.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          ...(previous ? [{ tokenHash: hashToken(previous) }] : []),
        ],
      },
    });
    await this.prisma.client.oAuthAttempt.create({
      data: {
        tokenHash: hashToken(token),
        state,
        nonce,
        codeVerifier,
        expiresAt: new Date(Date.now() + OAUTH_TTL_MS),
      },
    });
    return token;
  }

  async consumeAttempt(token?: string) {
    if (!token) throw new UnauthorizedException('Invalid OAuth response');
    const tokenHash = hashToken(token);
    const attempt = await this.prisma.client.oAuthAttempt.findUnique({ where: { tokenHash } });
    const removed = await this.prisma.client.oAuthAttempt.deleteMany({ where: { tokenHash } });
    if (!attempt || removed.count !== 1 || attempt.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException('Invalid OAuth response');
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

  async logout(tokenHash: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { tokenHash } });
  }
}
