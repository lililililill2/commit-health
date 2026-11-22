import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const examples = new Set(['.env.example', '.env.test.example', '.env.production.example']);
const privateDirectories = new Set([
  '.git',
  '.codex',
  '.vercel',
  '.aws',
  '.ssh',
  '.vscode',
  '.idea',
]);
const generatedDirectories = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.pnpm-store',
  'dist',
  'out',
  'coverage',
  '.verification',
]);

export function isPrivatePath(file) {
  const parts = file.replaceAll('\\', '/').toLowerCase().split('/');
  const name = parts.at(-1);
  return (
    parts.some((part) => privateDirectories.has(part)) ||
    parts.some((part) => (part === '.env' || part.startsWith('.env.')) && !examples.has(part)) ||
    /\.(pem|key|p12|pfx|log)$/.test(name) ||
    /^id_(rsa|ed25519|ecdsa)(\.pub)?$/.test(name) ||
    ['.npmrc.local', '.netrc', '_netrc'].includes(name) ||
    (parts.includes('.agents') && !(parts[0] === '.agents' && parts[1] === 'skills'))
  );
}

export function isSourcePath(file) {
  const normalized = file.replaceAll('\\', '/');
  return (
    !isPrivatePath(normalized) &&
    !normalized.split('/').some((part) => generatedDirectories.has(part)) &&
    !normalized.startsWith('apps/server/src/generated/') &&
    !normalized.endsWith('.tsbuildinfo')
  );
}

export function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
}

export function sourceFiles(root) {
  return [
    ...new Set(
      git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0'),
    ),
  ]
    .filter((file) => file && isSourcePath(file))
    .sort();
}

export function confinedPath(root, file) {
  if (
    !file ||
    path.isAbsolute(file) ||
    file.includes('\\') ||
    file.split('/').includes('..') ||
    file.includes(':')
  )
    throw new Error('Invalid snapshot path');
  const target = path.resolve(root, file);
  if (!target.startsWith(path.resolve(root) + path.sep))
    throw new Error('Path leaves snapshot root');
  return target;
}

export function copySource(root, destination, files = sourceFiles(root)) {
  let copied = 0;
  for (const file of files) {
    if (!isSourcePath(file)) continue;
    const source = confinedPath(root, file);
    // Inspect each ancestor too: a regular file can be reached through a junction.
    let cursor = root;
    for (const part of file.split('/')) {
      cursor = path.join(cursor, part);
      let stat;
      try {
        stat = lstatSync(cursor);
      } catch (error) {
        if (error.code === 'ENOENT') break;
        throw error;
      }
      if (stat.isSymbolicLink()) throw new Error('Snapshot refuses symlinks and junctions');
    }
    if (!existsSync(source)) continue; // A tracked file may have been deleted in the working tree.
    if (!lstatSync(source).isFile()) throw new Error('Snapshot expects regular source files');
    const target = confinedPath(destination, file);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(source, target);
    copied++;
  }
  return copied;
}

export function verificationEnvironment(temp, inherited = process.env) {
  const allowed = new Set([
    'path',
    'systemroot',
    'windir',
    'comspec',
    'pathext',
    'localappdata',
    'appdata',
    'programfiles',
    'programfiles(x86)',
  ]);
  const env = Object.fromEntries(
    Object.entries(inherited).filter(([key]) => allowed.has(key.toLowerCase())),
  );
  return {
    ...env,
    HOME: temp,
    USERPROFILE: temp,
    TMP: temp,
    TEMP: temp,
    TMPDIR: temp,
    NPM_CONFIG_USERCONFIG: path.join(temp, 'empty.npmrc'),
    NPM_CONFIG_GLOBALCONFIG: path.join(temp, 'empty-global.npmrc'),
    // Turbo also resolves Vercel auth configuration even with remote caching disabled.
    TURBO_CONFIG_DIR_PATH: path.join(temp, 'turbo-config'),
    VERCEL_CONFIG_DIR_PATH: path.join(temp, 'vercel-config'),
    XDG_CONFIG_HOME: path.join(temp, 'config'),
    CI: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
    TURBO_TELEMETRY_DISABLED: '1',
    NEXT_PUBLIC_API_BASE_URL: '/api',
    API_SERVER_ORIGIN: 'https://api.example.test',
    FRONTEND_URL: 'https://web.example.test',
    CORS_ORIGIN: 'https://web.example.test',
    GOOGLE_CALLBACK_URL: 'https://web.example.test/api/auth/google/callback',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
    COOKIE_SAME_SITE: 'lax',
  };
}

export function verificationPlan(scope, build = false) {
  if (!['web', 'server', 'all'].includes(scope))
    throw new Error('scope must be web, server, or all');
  const scopes = scope === 'all' ? ['web', 'server'] : [scope];
  const plan = [];
  if (scopes.includes('server')) plan.push(['prisma:generate']);
  for (const command of ['lint', 'typecheck', 'test']) {
    for (const app of scopes) plan.push(['--filter', `@commit-health/${app}`, command]);
  }
  if (scopes.includes('server')) plan.push(['test:e2e'], ['prisma:validate']);
  if (build)
    plan.push([
      'exec',
      'turbo',
      'run',
      'build',
      '--ui=stream',
      ...scopes.map((app) => `--filter=@commit-health/${app}`),
    ]);
  return plan;
}

export function parseOptions(args) {
  const options = { scope: 'all', build: false, online: false, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue;
    if (args[i] === '--scope') options.scope = args[++i];
    else if (args[i] === '--build') options.build = true;
    else if (args[i] === '--online') options.online = true;
    else if (args[i] === '--dry-run') options.dryRun = true;
    else throw new Error('Supported flags: --scope web|server|all, --build, --online, --dry-run');
  }
  verificationPlan(options.scope, options.build);
  return options;
}
