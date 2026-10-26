import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

export const PUBLIC_ROUTE = 'auth:public';
export const Public = () => SetMetadata(PUBLIC_ROUTE, true);

export interface SessionUser {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedSession {
  tokenHash: string;
  csrfToken: string;
  user: SessionUser;
}

export type AuthenticatedRequest = Request & { auth?: AuthenticatedSession };

// Use this identity for every future user's data query; never trust a userId from the client.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().auth?.user;
    if (!user) throw new UnauthorizedException();
    return user;
  },
);
