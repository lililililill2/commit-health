import { validateEnvironment } from './environment.js';

describe('environment configuration', () => {
  it('provides development defaults without requiring a database', () => {
    expect(validateEnvironment({})).toMatchObject({
      PORT: 8080,
      CORS_ORIGIN: 'http://localhost:3000',
      NODE_ENV: 'development',
    });
  });

  it('converts the port from an environment string', () => {
    expect(validateEnvironment({ PORT: '8081' }).PORT).toBe(8081);
  });

  it.each(['invalid', '0', '65536'])('rejects invalid port %s', (PORT) => {
    expect(() => validateEnvironment({ PORT })).toThrow('PORT');
  });

  it.each(['*', '', 'http://localhost:3000/path'])(
    'rejects invalid CORS origin %s',
    (CORS_ORIGIN) => {
      expect(() => validateEnvironment({ CORS_ORIGIN })).toThrow('CORS_ORIGIN');
    },
  );

  it('rejects a malformed database URL when provided', () => {
    expect(() => validateEnvironment({ DATABASE_URL: 'mysql://localhost/db' })).toThrow(
      'DATABASE_URL',
    );
  });

  it('rejects partial Google credentials', () => {
    expect(() => validateEnvironment({ GOOGLE_CLIENT_ID: 'configured' })).toThrow('Configure both');
  });

  it('requires HTTPS origins and callback in production', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow();
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        FRONTEND_URL: 'https://app.example.com',
        CORS_ORIGIN: 'https://app.example.com',
        GOOGLE_CALLBACK_URL: 'https://api.example.com/api/auth/google/callback',
        COOKIE_SAME_SITE: 'none',
      }).COOKIE_SAME_SITE,
    ).toBe('none');
  });

  it('rejects insecure SameSite=None cookies and unapproved frontend origins', () => {
    expect(() => validateEnvironment({ COOKIE_SAME_SITE: 'none' })).toThrow();
    expect(() => validateEnvironment({ FRONTEND_URL: 'http://localhost:3001' })).toThrow();
  });
});
