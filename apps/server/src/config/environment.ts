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

  return environment;
}
