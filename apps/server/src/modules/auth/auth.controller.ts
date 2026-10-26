import { Controller, Get, Post, Req, Res, HttpCode } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';

import { Public, type AuthenticatedRequest } from '../../auth/auth-context.js';
import { AuthCookies } from './auth-cookies.js';
import { AuthService } from './auth.service.js';
import { GoogleOidcService } from './google-oidc.service.js';

@Controller('auth')
export class AuthController {
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

  @Public()
  @Get('google')
  async googleLogin(@Req() request: Request, @Res() response: Response): Promise<void> {
    this.privateResponse(response);
    try {
      const start = await this.google.begin();
      const attempt = await this.auth.createAttempt(
        start.state,
        start.nonce,
        start.codeVerifier,
        this.cookies.read(request, this.cookies.attemptName),
      );
      this.cookies.setAttempt(response, attempt);
      response.redirect(303, start.url);
    } catch {
      this.cookies.clearAttempt(response);
      response.redirect(303, this.frontend('/auth/error'));
    }
  }

  @Public()
  @Get('google/callback')
  async googleCallback(@Req() request: Request, @Res() response: Response): Promise<void> {
    this.privateResponse(response);
    this.cookies.clearAttempt(response);
    try {
      const attempt = await this.auth.consumeAttempt(
        this.cookies.read(request, this.cookies.attemptName),
      );
      const queryIndex = request.originalUrl.indexOf('?');
      const sub = await this.google.complete(
        queryIndex < 0 ? '' : request.originalUrl.slice(queryIndex),
        attempt,
      );
      const token = await this.auth.login(
        sub,
        this.cookies.read(request, this.cookies.sessionName),
      );
      this.cookies.setSession(response, token);
      response.redirect(303, this.frontend('/'));
    } catch {
      // Never log the callback URL, provider errors, authorization code, or tokens.
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
