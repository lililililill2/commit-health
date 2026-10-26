import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const defaultEnvFile = fileURLToPath(new URL('../../.env.test', import.meta.url));

export function validateTestDatabaseUrl(value: string | undefined): string {
  if (!value) throw new Error('Set TEST_DATABASE_URL in apps/server/.env.test or the environment');
  try {
    const url = new URL(value);
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      decodeURIComponent(url.pathname.slice(1)) !== 'commit_health_test'
    )
      throw new Error();
  } catch {
    // Never include the supplied URL or credentials in validation errors.
    throw new Error('TEST_DATABASE_URL must point only to PostgreSQL database commit_health_test');
  }
  return value;
}

export function getTestDatabaseUrl(
  environment: NodeJS.ProcessEnv = process.env,
  envFile: string = defaultEnvFile,
): string {
  const local = existsSync(envFile) ? parse(readFileSync(envFile)) : {};
  // Deliberately never fall back to DATABASE_URL or the development .env file.
  return validateTestDatabaseUrl(environment.TEST_DATABASE_URL ?? local.TEST_DATABASE_URL);
}
