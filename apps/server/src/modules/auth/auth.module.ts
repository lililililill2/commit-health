import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthCookies } from './auth-cookies.js';
import { GoogleOidcService } from './google-oidc.service.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookies,
    GoogleOidcService,
    { provide: APP_GUARD, useClass: SessionGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
