import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, isPrivatePath, sourceFiles, verificationPlan } from './lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (file) => readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));

try {
  const files = sourceFiles(root);
  const skills = files.filter((file) => /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(file));
  assert.ok(skills.length, 'No repository Skills found; check .gitignore');
  const guidance = [
    'AGENTS.md',
    'apps/web/AGENTS.md',
    'apps/server/AGENTS.md',
    'docs/architecture.md',
    'docs/agent-workflow.md',
    'docs/README.md',
    ...skills,
  ];
  for (const file of guidance) {
    const content = read(file);
    for (const [, target] of content.matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)) {
      if (/^(https?:|#)/.test(target)) continue;
      assert.ok(
        existsSync(
          path.resolve(root, path.dirname(file), decodeURIComponent(target.split('#')[0])),
        ),
        `Broken reference in ${file}: ${target}`,
      );
    }
  }
  for (const file of skills) {
    const content = read(file);
    const header = content.match(/^---\r?\n([\s\S]+?)\r?\n---(?:\r?\n|$)/)?.[1];
    assert.ok(header, `Missing Skill frontmatter: ${file}`);
    const name = header.match(/^name: ([a-z0-9-]{1,64})\r?$/m)?.[1];
    assert.equal(name, path.basename(path.dirname(file)), `Skill name must match folder: ${file}`);
    assert.ok(/^description: \S.+$/m.test(header), `Missing one-line Skill description: ${file}`);
  }
  const rootPackage = json('package.json');
  for (const plan of verificationPlan('all', true)) {
    if (plan[0] === '--filter') {
      const app = plan[1].split('/')[1];
      assert.ok(
        json(`apps/${app}/package.json`).scripts[plan[2]],
        `Missing ${app} script: ${plan[2]}`,
      );
    } else if (plan[0] !== 'exec')
      assert.ok(rootPackage.scripts[plan[0]], `Missing root script: ${plan[0]}`);
  }
  for (const command of ['context', 'check', 'verify']) {
    assert.ok(
      rootPackage.scripts[`agent:${command}`]?.includes(`scripts/agent/${command}.mjs`),
      `Missing agent:${command} wiring`,
    );
  }
  for (const file of files.filter((file) => /^scripts\/agent\/.*\.mjs$/.test(file))) {
    const result = spawnSync(process.execPath, ['--check', file], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
    });
    assert.equal(result.status, 0, `Invalid harness JavaScript: ${file}`);
  }
  assert.ok(
    read('.github/workflows/ci.yml').includes('pnpm agent:check'),
    'CI must check the harness',
  );
  const tracked = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  assert.equal(
    tracked.filter(isPrivatePath).length,
    0,
    'Protected local files are tracked; inspect filenames without printing contents',
  );
  for (const file of [
    '.env',
    '.env.local',
    'apps/server/.env',
    'apps/server/.env.production',
    'apps/server/.env.test',
    'apps/web/.env.local',
    '.codex/config.toml',
    '.agents/local-state.json',
  ]) {
    const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', file], {
      cwd: root,
      windowsHide: true,
    });
    assert.equal(result.status, 0, `Local configuration must be ignored: ${file}`);
  }
  for (const file of [...skills, 'apps/web/.env.example', 'apps/server/.env.production.example']) {
    const result = spawnSync('git', ['check-ignore', '--no-index', '--quiet', file], {
      cwd: root,
      windowsHide: true,
    });
    assert.equal(result.status, 1, `Shareable file is ignored: ${file}`);
  }
  const tests = spawnSync(process.execPath, ['--test', 'scripts/agent/harness.test.mjs'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
  });
  assert.equal(tests.status, 0, 'Harness regression tests failed');
  console.log(
    `PASS: ${skills.length} Skills, local references, command wiring and Git boundaries.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
