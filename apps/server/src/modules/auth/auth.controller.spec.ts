import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
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
      cookie: jest.fn(),
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
    await controller.googleLogin({ headers: {} } as Request, res as unknown as Response);
    expect(res.clearCookie).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(303, 'http://localhost:3000/auth/error');
    expect(warn).toHaveBeenCalledWith(
      'Google login failed: stage=provider_discovery, reason=unexpected_failure',
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain(detail);
  });

  it.each(
    [
      { Failure: Error, reason: 'unexpected_failure' },
      { Failure: UnauthorizedException, reason: 'invalid_response' },
      { Failure: ServiceUnavailableException, reason: 'unavailable' },
    ].flatMap(({ Failure, reason }) => [
      { phase: 'creation', stage: 'attempt_storage', Failure, reason },
      { phase: 'consumption', stage: 'attempt_consumption', Failure, reason },
    ]),
  )(
    'logs $phase failures as $stage/$reason without exposing secrets',
    async ({ phase, stage, Failure, reason }) => {
      const browserToken = randomToken();
      const code = 'private-authorization-code';
      const detail = 'private-attempt-error';
      const start = {
        state: randomToken(),
        nonce: randomToken(),
        codeVerifier: randomToken(),
        url: 'https://accounts.example/authorize',
      };
      const originalUrl = `/api/auth/google/callback?state=${start.state}&code=${code}`;
      const secretValues = [
        detail,
        browserToken,
        code,
        originalUrl,
        start.url,
        start.state,
        start.nonce,
        start.codeVerifier,
      ];
      const failure = new Failure(secretValues.join(' '));
      const auth = {
        createAttempt: jest.fn<AuthService['createAttempt']>(),
        consumeAttempt: jest.fn<AuthService['consumeAttempt']>(),
        login: jest.fn<AuthService['login']>(),
      };
      const google = {
        begin: jest.fn<GoogleOidcService['begin']>().mockResolvedValue(start),
        complete: jest.fn<GoogleOidcService['complete']>(),
      };
      const controller = new AuthController(
        auth as unknown as AuthService,
        google as unknown as GoogleOidcService,
        cookies,
        config,
      );
      const req = {
        headers: { cookie: `${cookies.attemptBrowserName}=${browserToken}` },
        originalUrl,
      } as Request;
      const res = response();
      if (phase === 'creation') {
        auth.createAttempt.mockRejectedValue(failure);
        await controller.googleLogin(req, res as unknown as Response);
      } else {
        auth.consumeAttempt.mockRejectedValue(failure);
        await controller.googleCallback(req, res as unknown as Response);
      }
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(`Google login failed: stage=${stage}, reason=${reason}`);
      for (const value of secretValues)
        expect(JSON.stringify(warn.mock.calls)).not.toContain(value);
      expect(res.redirect).toHaveBeenCalledWith(303, 'http://localhost:3000/auth/error');
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.clearCookie).not.toHaveBeenCalled();
      expect(google.complete).not.toHaveBeenCalled();
      expect(auth.login).not.toHaveBeenCalled();
    },
  );

  it.each(['legacy', 'shared'])(
    'preserves other login attempts and logs no secrets for a %s cookie',
    async (mode) => {
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
            cookie:
              mode === 'legacy'
                ? `${cookies.attemptName(state)}=${token}; ${cookies.attemptName(otherState)}=${randomToken()}`
                : `${cookies.attemptBrowserName}=${token}`,
          },
          originalUrl: `/api/auth/google/callback?state=${state}&code=${code}`,
        } as Request,
        res as unknown as Response,
      );
      expect(auth.consumeAttempt).toHaveBeenCalledWith(token, state);
      expect(res.clearCookie).toHaveBeenCalledTimes(mode === 'legacy' ? 1 : 0);
      if (mode === 'legacy')
        expect(res.clearCookie.mock.calls[0][0]).toBe(cookies.attemptName(state));
      expect(auth.login).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        'Google login failed: stage=identity_verification, reason=unexpected_failure',
      );
      for (const value of [code, token, state, detail, attempt.nonce, attempt.codeVerifier])
        expect(JSON.stringify(warn.mock.calls)).not.toContain(value);
    },
  );

  it('reuses one browser cookie when starting another login', async () => {
    const browserToken = randomToken();
    const start = {
      state: randomToken(),
      nonce: randomToken(),
      codeVerifier: randomToken(),
      url: 'https://accounts.example/authorize',
    };
    const auth = {
      createAttempt: jest.fn<AuthService['createAttempt']>().mockResolvedValue(undefined),
    };
    const google = { begin: jest.fn<GoogleOidcService['begin']>().mockResolvedValue(start) };
    const controller = new AuthController(
      auth as unknown as AuthService,
      google as unknown as GoogleOidcService,
      cookies,
      config,
    );
    const res = response();
    await controller.googleLogin(
      { headers: { cookie: `${cookies.attemptBrowserName}=${browserToken}` } } as Request,
      res as unknown as Response,
    );
    expect(auth.createAttempt).toHaveBeenCalledWith(
      start.state,
      start.nonce,
      start.codeVerifier,
      browserToken,
    );
    expect(res.cookie).toHaveBeenCalledTimes(1);
    expect(res.cookie.mock.calls[0].slice(0, 2)).toEqual([
      cookies.attemptBrowserName,
      browserToken,
    ]);
    expect(res.redirect).toHaveBeenCalledWith(303, start.url);
  });
});
