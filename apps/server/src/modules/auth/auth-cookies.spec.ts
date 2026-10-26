import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { AuthCookies } from './auth-cookies.js';

describe('authentication cookies', () => {
  it.each(['lax', 'none'])(
    'uses HttpOnly host-only Secure cookies in production with SameSite=%s',
    (sameSite) => {
      const cookies = new AuthCookies(
        new ConfigService({ NODE_ENV: 'production', COOKIE_SAME_SITE: sameSite }),
      );
      const writes: { name: unknown; options: unknown }[] = [];
      const response = {
        cookie: (name: unknown, _value: unknown, options: unknown) =>
          writes.push({ name, options }),
      } as unknown as Response;
      cookies.setSession(response, 'test-token');
      cookies.setAttempt(response, 'test-attempt');
      expect(writes[0]).toMatchObject({
        name: '__Host-commit_health_session',
        options: { httpOnly: true, secure: true, path: '/', sameSite },
      });
      expect(writes[0].options).not.toHaveProperty('domain');
      expect(writes[1]).toMatchObject({ options: { sameSite: 'lax', secure: true } });
    },
  );
});
