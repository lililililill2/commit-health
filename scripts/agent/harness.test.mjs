import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  confinedPath,
  copySource,
  git,
  isSourcePath,
  parseOptions,
  sourceFiles,
  verificationEnvironment,
  verificationPlan,
} from './lib.mjs';

function cleanup(temp) {
  assert.equal(path.dirname(path.resolve(temp)), path.resolve(tmpdir()));
  assert.ok(path.basename(temp).startsWith('commit-health-harness-test-'));
  rmSync(temp, { recursive: true, force: true });
}

test('snapshot excludes private configuration and generated output but retains Skills and examples', () => {
  for (const file of [
    '.env',
    'apps/server/.env.production',
    'apps/web/.env.local',
    '.codex/config.toml',
    '.vercel/project.json',
    'private.key',
    'output.log',
    '.agents/state.json',
    'node_modules/x.js',
    'apps/server/src/generated/prisma/client.ts',
    'apps/web/.next/types/routes.ts',
  ])
    assert.equal(isSourcePath(file), false, file);
  for (const file of [
    '.agents/skills/commit-health-feature/SKILL.md',
    'apps/server/.env.production.example',
    'apps/web/.env.example',
    'apps/server/src/main.ts',
  ])
    assert.equal(isSourcePath(file), true, file);
});

test('verification inherits only OS settings and replaces public test configuration', () => {
  const env = verificationEnvironment('/temporary', {
    PATH: '/bin',
    SystemRoot: 'C:/Windows',
    DATABASE_URL: 'dummy',
    TEST_DATABASE_URL: 'dummy',
    GOOGLE_CLIENT_SECRET: 'dummy',
    GITHUB_TOKEN: 'dummy',
    NODE_OPTIONS: '--require malicious.js',
    npm_config_userconfig: '/private/npmrc',
    API_SERVER_ORIGIN: 'https://real.example',
  });
  assert.equal(env.PATH, '/bin');
  assert.equal(env.SystemRoot, 'C:/Windows');
  for (const key of [
    'DATABASE_URL',
    'TEST_DATABASE_URL',
    'GITHUB_TOKEN',
    'NODE_OPTIONS',
    'npm_config_userconfig',
  ])
    assert.equal(env[key], undefined);
  assert.equal(env.GOOGLE_CLIENT_SECRET, '');
  assert.equal(env.API_SERVER_ORIGIN, 'https://api.example.test');
  assert.equal(env.NPM_CONFIG_USERCONFIG, path.join('/temporary', 'empty.npmrc'));
  assert.equal(env.TURBO_CONFIG_DIR_PATH, path.join('/temporary', 'turbo-config'));
  assert.equal(env.VERCEL_CONFIG_DIR_PATH, path.join('/temporary', 'vercel-config'));
});

test('verification plans select existing app tasks without DB or deployment commands', () => {
  const web = verificationPlan('web');
  assert.deepEqual(
    web.map((args) => args.at(-1)),
    ['lint', 'typecheck', 'test'],
  );
  assert.ok(web.every((args) => args.includes('@commit-health/web')));
  const server = verificationPlan('server', true);
  assert.ok(server.some((args) => args[0] === 'test:e2e'));
  assert.ok(server.at(-1).includes('--filter=@commit-health/server'));
  for (const scope of ['web', 'server', 'all']) {
    assert.doesNotMatch(
      JSON.stringify(verificationPlan(scope, true)),
      /test:db|migrate|deploy|studio|db push/,
    );
  }
  assert.throws(() => parseOptions(['--scope', 'server;echo']));
  assert.throws(() => parseOptions(['--scope']));
  assert.throws(() => parseOptions(['--deploy']));
  assert.deepEqual(parseOptions(['--scope', 'web', '--build', '--dry-run']), {
    scope: 'web',
    build: true,
    online: false,
    dryRun: true,
  });
});

test('snapshot copies current source, skips deleted and private files, and rejects escaping paths', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'commit-health-harness-test-'));
  try {
    const source = path.join(temp, 'source'),
      destination = path.join(temp, 'destination');
    mkdirSync(source);
    mkdirSync(destination);
    writeFileSync(path.join(source, 'current.ts'), 'export const current = true;');
    writeFileSync(path.join(source, '.env'), 'DUMMY=never-copy');
    assert.equal(copySource(source, destination, ['current.ts', 'deleted.ts', '.env']), 1);
    assert.equal(
      readFileSync(path.join(destination, 'current.ts'), 'utf8'),
      'export const current = true;',
    );
    assert.equal(existsSync(path.join(destination, '.env')), false);
    assert.throws(() => confinedPath(source, '../outside'));
    assert.throws(() => confinedPath(source, 'C:/outside'));
    assert.throws(() => confinedPath(source, 'nested/../../outside'));
  } finally {
    cleanup(temp);
  }
});

test('snapshot refuses directory symlinks or junctions before following them', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'commit-health-harness-test-'));
  try {
    const source = path.join(temp, 'source'),
      outside = path.join(temp, 'outside'),
      destination = path.join(temp, 'destination');
    mkdirSync(source);
    mkdirSync(outside);
    mkdirSync(destination);
    writeFileSync(path.join(outside, 'file.ts'), 'must not follow');
    symlinkSync(
      outside,
      path.join(source, 'link'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
    assert.throws(
      () => copySource(source, destination, ['link/file.ts']),
      /symlinks and junctions/,
    );
    assert.equal(existsSync(path.join(destination, 'link/file.ts')), false);
  } finally {
    cleanup(temp);
  }
});

test('Git snapshot includes unstaged and new work without reviving deleted or ignored files', () => {
  const temp = mkdtempSync(path.join(tmpdir(), 'commit-health-harness-test-'));
  try {
    const source = path.join(temp, 'source'),
      destination = path.join(temp, 'destination');
    mkdirSync(source);
    mkdirSync(destination);
    git(source, ['init', '--quiet']);
    writeFileSync(path.join(source, '.gitignore'), '.env\nignored.txt\n');
    writeFileSync(path.join(source, 'tracked.ts'), 'staged');
    writeFileSync(path.join(source, 'deleted.ts'), 'deleted');
    git(source, ['-c', 'core.autocrlf=false', 'add', '.gitignore', 'tracked.ts', 'deleted.ts']);
    writeFileSync(path.join(source, 'tracked.ts'), 'working tree');
    writeFileSync(path.join(source, 'new.ts'), 'new source');
    writeFileSync(path.join(source, 'ignored.txt'), 'ignored');
    writeFileSync(path.join(source, '.env'), 'DUMMY=private-fixture');
    rmSync(path.join(source, 'deleted.ts'));
    copySource(source, destination, sourceFiles(source));
    assert.equal(readFileSync(path.join(destination, 'tracked.ts'), 'utf8'), 'working tree');
    assert.equal(readFileSync(path.join(destination, 'new.ts'), 'utf8'), 'new source');
    for (const file of ['deleted.ts', '.env', 'ignored.txt', '.git'])
      assert.equal(existsSync(path.join(destination, file)), false);
  } finally {
    cleanup(temp);
  }
});
