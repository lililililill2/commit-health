import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { getTestDatabaseUrl, validateTestDatabaseUrl } from '../../test/helpers/test-database.js';

const TEST_URL = 'postgresql://test_user:test_only@localhost:5432/commit_health_test?schema=public';
const DEV_URL = 'postgresql://test_user:test_only@localhost:5432/commit_health_dev';

describe('test database isolation', () => {
  let directory: string;
  let envFile: string;
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'commit-health-test-env-'));
    envFile = join(directory, '.env.test');
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('accepts only the dedicated test database', () => {
    expect(validateTestDatabaseUrl(TEST_URL)).toBe(TEST_URL);
  });

  it.each([
    DEV_URL,
    'postgresql://test_user:test_only@localhost/postgres',
    'postgresql://test_user:test_only@localhost/commit_health_prod',
    'postgresql://test_user:test_only@localhost/commit_health_test_backup',
    'https://localhost/commit_health_test',
    'invalid',
  ])('rejects a non-test target %#', (value) => {
    expect(() => validateTestDatabaseUrl(value)).toThrow('must point only');
  });

  it('never falls back to the development DATABASE_URL', () => {
    expect(() => getTestDatabaseUrl({ DATABASE_URL: DEV_URL }, envFile)).toThrow(
      'Set TEST_DATABASE_URL',
    );
  });

  it('loads the separate test env file', () => {
    writeFileSync(envFile, `TEST_DATABASE_URL="${TEST_URL}"\n`);
    expect(getTestDatabaseUrl({}, envFile)).toBe(TEST_URL);
  });

  it('prefers an explicitly configured environment variable', () => {
    writeFileSync(envFile, `TEST_DATABASE_URL=${DEV_URL}\n`);
    expect(getTestDatabaseUrl({ TEST_DATABASE_URL: TEST_URL }, envFile)).toBe(TEST_URL);
  });

  it('rejects an explicitly empty environment variable instead of silently falling back', () => {
    writeFileSync(envFile, `TEST_DATABASE_URL=${TEST_URL}\n`);
    expect(() => getTestDatabaseUrl({ TEST_DATABASE_URL: '' }, envFile)).toThrow(
      'Set TEST_DATABASE_URL',
    );
  });

  it('does not include the supplied connection string in an error', () => {
    let failure: unknown;
    try {
      validateTestDatabaseUrl(DEV_URL);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    if (failure instanceof Error) expect(failure.message.includes(DEV_URL)).toBe(false);
  });
});
