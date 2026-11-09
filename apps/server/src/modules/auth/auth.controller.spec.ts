import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { AuthController } from './auth.controller.js';
import { AuthCookies } from './auth-cookies.js';
import { AuthService, hashToken, randomToken } from './auth.service.js';
import { GoogleOidcService } from './google-oidc.service.js';

describe('OAuth failure isolation and logging', () => {
  const config = new ConfigService({ FRONTEND_URL: 'http://localhost:3000' });
  const cookies = new AuthCookies(config);
  let warn: jest.SpiedFunction<Logger['warn']>;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  function response() {
    return {
      setHeader: jest.fn(),
      clearCookie: jest.fn(),
      redirect: jest.fn(),
    };
  }

  it('keeps other login cookies when starting a login fails and logs no exception details', async () => {
    const detail = 'private-provider-error-that-must-not-be-logged';
    const google = {
      begin: jest.fn<GoogleOidcService['begin']>().mockRejectedValue(new Error(detail)),
    };
    const controller = new AuthController(
      {} as AuthService,
      google as unknown as GoogleOidcService,
      cookies,
      config,
    );
    const res = response();
    await controller.googleLogin(res as unknown as Response);
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(303, 'http://localhost:3000/auth/error');
    expect(warn).toHaveBeenCalledWith(
      'Google login failed: stage=provider_discovery, reason=unexpected_failure',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(detail);
  });

  it('clears only the consumed request cookie and never logs callback codes or token values', async () => {
    const state = randomToken();
    const otherState = randomToken();
    const token = randomToken();
    const code = 'private-authorization-code';
    const detail = 'private-token-verification-error';
    const attempt = {
      tokenHash: hashToken(token),
      state,
      nonce: randomToken(),
      codeVerifier: randomToken(),
      expiresAt: new Date(Date.now() + 60_000),
    };
    const auth = {
      consumeAttempt: jest.fn<AuthService['consumeAttempt']>().mockResolvedValue(attempt),
      login: jest.fn<AuthService['login']>(),
    };
    const google = {
      complete: jest.fn<GoogleOidcService['complete']>().mockRejectedValue(new Error(detail)),
    };
    const controller = new AuthController(
      auth as unknown as AuthService,
      google as unknown as GoogleOidcService,
      cookies,
      config,
    );
    const res = response();
    await controller.googleCallback(
      {
        headers: {
          cookie: `${cookies.attemptName(state)}=${token}; ${cookies.attemptName(otherState)}=${randomToken()}`,
        },
        originalUrl: `/api/auth/google/callback?state=${state}&code=${code}`,
      } as Request,
      res as unknown as Response,
    );
    expect(auth.consumeAttempt).toHaveBeenCalledWith(token, state);
    expect(res.clearCookie).toHaveBeenCalledTimes(1);
    expect(res.clearCookie.mock.calls[0][0]).toBe(cookies.attemptName(state));
    expect(auth.login).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      'Google login failed: stage=identity_verification, reason=unexpected_failure',
    );
    for (const value of [code, token, state, detail, attempt.nonce, attempt.codeVerifier])
      expect(JSON.stringify(warn.mock.calls)).not.toContain(value);
  });
});
