import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';

class Environment {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: string = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 8080;

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3000';

  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsString()
  GOOGLE_CLIENT_ID: string = '';

  @IsString()
  GOOGLE_CLIENT_SECRET: string = '';

  @IsString()
  GOOGLE_CALLBACK_URL: string = 'http://localhost:8080/api/auth/google/callback';

  @IsString()
  FRONTEND_URL: string = 'http://localhost:3000';

  @IsIn(['lax', 'none'])
  COOKIE_SAME_SITE: 'lax' | 'none' = 'lax';
}

export function validateEnvironment(config: Record<string, unknown>): Environment {
  const environment = plainToInstance(Environment, config, { enableImplicitConversion: true });
  const errors = validateSync(environment, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment variables: ${errors.map((error) => error.property).join(', ')}`,
    );
  }

  const origins = environment.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  if (
    origins.some((origin) => {
      try {
        const url = new URL(origin);
        return !['http:', 'https:'].includes(url.protocol) || url.origin !== origin;
      } catch {
        return true;
      }
    })
  ) {
    throw new Error('CORS_ORIGIN must contain comma-separated HTTP(S) origins');
  }

  if (environment.DATABASE_URL !== undefined) {
    try {
      const url = new URL(environment.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
        throw new Error('Unsupported database protocol');
      }
    } catch {
      throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
    }
  }

  for (const key of ['FRONTEND_URL', 'GOOGLE_CALLBACK_URL'] as const) {
    try {
      const url = new URL(environment[key]);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
      if (key === 'FRONTEND_URL' && url.origin !== environment[key]) throw new Error();
      if (key === 'GOOGLE_CALLBACK_URL' && url.pathname !== '/api/auth/google/callback')
        throw new Error();
      if (environment.NODE_ENV === 'production' && url.protocol !== 'https:') throw new Error();
    } catch {
      throw new Error(`Invalid ${key}`);
    }
  }
  if (!origins.includes(environment.FRONTEND_URL))
    throw new Error('CORS_ORIGIN must include FRONTEND_URL');
  if (
    environment.NODE_ENV === 'production' &&
    origins.some((origin) => !origin.startsWith('https://'))
  )
    throw new Error('Production CORS origins must use HTTPS');
  if (environment.COOKIE_SAME_SITE === 'none' && environment.NODE_ENV !== 'production')
    throw new Error('SameSite=None requires production Secure cookies');
  if (Boolean(environment.GOOGLE_CLIENT_ID) !== Boolean(environment.GOOGLE_CLIENT_SECRET))
    throw new Error('Configure both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  return environment;
}
