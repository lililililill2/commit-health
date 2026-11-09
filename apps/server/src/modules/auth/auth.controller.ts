import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  HttpCode,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { Public, type AuthenticatedRequest } from '../../auth/auth-context.js';
import { AuthCookies } from './auth-cookies.js';
import { AuthService, randomToken } from './auth.service.js';
import { GoogleOidcService, oauthCallbackState } from './google-oidc.service.js';

type LoginStage =
  | 'provider_discovery'
  | 'attempt_storage'
  | 'attempt_consumption'
  | 'callback_validation'
  | 'identity_verification'
  | 'session_storage';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    private readonly google: GoogleOidcService,
    private readonly cookies: AuthCookies,
    private readonly config: ConfigService,
  ) {}

  private privateResponse(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Referrer-Policy', 'no-referrer');
  }
  private frontend(path: string): string {
    return new URL(path, this.config.getOrThrow<string>('FRONTEND_URL')).href;
  }

  private reportFailure(stage: LoginStage, error: unknown): void {
    const reason =
      error instanceof UnauthorizedException
        ? 'invalid_response'
        : error instanceof ServiceUnavailableException
          ? 'unavailable'
          : 'unexpected_failure';
    // Log only allowlisted stages/categories, never exception messages, URLs, or credentials.
    this.logger.warn(`Google login failed: stage=${stage}, reason=${reason}`);
  }

  @Public()
  @Get('google')
  async googleLogin(@Req() request: Request, @Res() response: Response): Promise<void> {
    this.privateResponse(response);
    let stage: LoginStage = 'provider_discovery';
    try {
      const start = await this.google.begin();
      stage = 'attempt_storage';
      const browserToken =
        this.cookies.read(request, this.cookies.attemptBrowserName) ?? randomToken();
      await this.auth.createAttempt(start.state, start.nonce, start.codeVerifier, browserToken);
      this.cookies.setAttemptBrowser(response, browserToken);
      response.redirect(303, start.url);
    } catch (error) {
      this.reportFailure(stage, error);
      response.redirect(303, this.frontend('/auth/error'));
    }
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    this.privateResponse(response);
    let stage: LoginStage = 'callback_validation';
    try {
      const queryIndex = request.originalUrl.indexOf('?');
      const query = queryIndex < 0 ? '' : request.originalUrl.slice(queryIndex);
      const state = oauthCallbackState(query);
      stage = 'attempt_consumption';
      const legacyToken = this.cookies.read(request, this.cookies.attemptName(state));
      const attempt = await this.auth.consumeAttempt(
        legacyToken ?? this.cookies.read(request, this.cookies.attemptBrowserName),
        state,
      );
      if (legacyToken) this.cookies.clearAttempt(response, state);
      stage = 'identity_verification';
      const sub = await this.google.complete(query, attempt);
      stage = 'session_storage';
      const token = await this.auth.login(
        sub,
        this.cookies.read(request, this.cookies.sessionName),
      );
      this.cookies.setSession(response, token);
      response.redirect(303, this.frontend('/'));
    } catch (error) {
      this.reportFailure(stage, error);
      response.redirect(303, this.frontend('/auth/error'));
    }
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest, @Res({ passthrough: true }) response: Response) {
    this.privateResponse(response);
    return { user: request.auth!.user, csrfToken: request.auth!.csrfToken };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    this.privateResponse(response);
    await this.auth.logout(request.auth!.tokenHash);
    this.cookies.clearSession(response);
  }
}
