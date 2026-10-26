import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseCookie } from 'cookie';
import type { Request, Response, CookieOptions } from 'express';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
export const OAUTH_TTL_MS = 10 * 60 * 1_000;

@Injectable()
export class AuthCookies {
  constructor(private readonly config: ConfigService) {}

  private get secure(): boolean {
    return this.config.get<string>('NODE_ENV') === 'production';
  }
  get sessionName(): string {
    return `${this.secure ? '__Host-' : ''}commit_health_session`;
  }
  get attemptName(): string {
    return `${this.secure ? '__Host-' : ''}commit_health_oauth`;
  }

  read(request: Request, name: string): string | undefined {
    const value = parseCookie(request.headers.cookie ?? '')[name];
    return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
  }

  private options(attempt = false): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: attempt ? 'lax' : this.config.get<'lax' | 'none'>('COOKIE_SAME_SITE', 'lax'),
      path: '/',
    };
  }

  setSession(response: Response, token: string): void {
    response.cookie(this.sessionName, token, { ...this.options(), maxAge: SESSION_TTL_MS });
  }
  clearSession(response: Response): void {
    response.clearCookie(this.sessionName, this.options());
  }
  setAttempt(response: Response, token: string): void {
    response.cookie(this.attemptName, token, { ...this.options(true), maxAge: OAUTH_TTL_MS });
  }
  clearAttempt(response: Response): void {
    response.clearCookie(this.attemptName, this.options(true));
  }
}
