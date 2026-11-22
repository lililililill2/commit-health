import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copySource, parseOptions, verificationEnvironment, verificationPlan } from './lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

function runPnpm(args, cwd, env) {
  // Windows .cmd needs cmd.exe. Only fixed plan tokens reach the shell; never interpolate paths or user command text.
  if (args.some((arg) => !/^[A-Za-z0-9_@./:=+-]+$/.test(arg)))
    throw new Error('Invalid command token');
  console.log(`\n> pnpm ${args.join(' ')}`);
  const windows = process.platform === 'win32';
  const result = spawnSync(
    windows ? 'cmd.exe' : 'pnpm',
    windows ? ['/d', '/s', '/c', `pnpm ${args.join(' ')}`] : args,
    {
      cwd,
      env,
      stdio: 'inherit',
      windowsHide: true,
      timeout: 10 * 60 * 1000,
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`Verification command failed: pnpm ${args.join(' ')}`);
}

let temporary;
const tempRoot = realpathSync(tmpdir());
try {
  const options = parseOptions(process.argv.slice(2));
  const plan = [
    ['install', '--frozen-lockfile', '--ignore-scripts', ...(options.online ? [] : ['--offline'])],
    ...verificationPlan(options.scope, options.build),
  ];
  if (options.dryRun) {
    console.log(plan.map((args) => `pnpm ${args.join(' ')}`).join('\n'));
    console.log(
      'Isolated working-tree snapshot; no DB tests, migrations, deployment or real credentials.',
    );
  } else {
    temporary = mkdtempSync(path.join(tempRoot, 'commit-health-verify-'));
    const snapshot = path.join(temporary, 'source');
    mkdirSync(snapshot);
    const count = copySource(root, snapshot);
    writeFileSync(path.join(temporary, 'empty.npmrc'), '');
    writeFileSync(path.join(temporary, 'empty-global.npmrc'), '');
    console.log(`Temporary source: ${snapshot} (${count} files)`);
    const env = verificationEnvironment(temporary);
    for (const args of plan) runPnpm(args, snapshot, env);
    console.log(
      `\nPASS: ${options.scope}${options.build ? ' including build' : ''}. DB/browser/production checks were not run.`,
    );
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (temporary) {
    // Only remove the exact directory this invocation created immediately below the OS temp root.
    if (
      path.dirname(temporary) !== tempRoot ||
      !path.basename(temporary).startsWith('commit-health-verify-')
    ) {
      throw new Error('Refusing cleanup outside the owned temporary directory');
    }
    try {
      rmSync(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      console.error(`Temporary cleanup failed; inspect before removing: ${temporary}`);
      process.exitCode = 1;
    }
  }
}
