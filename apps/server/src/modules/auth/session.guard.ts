import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { PUBLIC_ROUTE, type AuthenticatedRequest } from '../../auth/auth-context.js';
import { AuthService, equalToken } from './auth.service.js';
import { AuthCookies } from './auth-cookies.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.auth.resolveSession(
      this.cookies.read(request, this.cookies.sessionName),
    );
    if (!session) throw new UnauthorizedException('로그인이 필요합니다.');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      const csrf = request.get('X-CSRF-Token');
      if (
        request.get('Origin') !== this.config.getOrThrow<string>('FRONTEND_URL') ||
        !csrf ||
        !/^[A-Za-z0-9_-]{43}$/.test(csrf) ||
        !equalToken(csrf, session.csrfToken)
      ) {
        throw new ForbiddenException('Invalid CSRF request');
      }
    }
    request.auth = session;
    return true;
  }
}
