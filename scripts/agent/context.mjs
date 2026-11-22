import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, sourceFiles } from './lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const json = (file) => JSON.parse(readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
const files = sourceFiles(root).filter((file) => existsSync(path.join(root, file)));
const pkg = json('package.json');
const schema = readFileSync(
  new URL('../../apps/server/prisma/schema.prisma', import.meta.url),
  'utf8',
);

console.log(
  JSON.stringify(
    {
      branch: git(root, ['branch', '--show-current']).trim() || '(detached HEAD)',
      head: git(root, ['rev-parse', '--short', 'HEAD']).trim(),
      status: git(root, ['status', '--short', '--untracked-files=all']).trim(),
      runtime: {
        node: readFileSync(new URL('../../.node-version', import.meta.url), 'utf8').trim(),
        packageManager: pkg.packageManager,
      },
      workspaces: ['web', 'server'].map((app) => {
        const manifest = json(`apps/${app}/package.json`);
        return {
          name: manifest.name,
          dependencies: manifest.dependencies,
          tasks: Object.keys(manifest.scripts),
        };
      }),
      routes: files.filter((file) =>
        /^apps\/web\/app\/.*\/page\.tsx$|^apps\/web\/app\/page\.tsx$/.test(file),
      ),
      controllers: files.filter((file) => file.endsWith('.controller.ts')),
      models: [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((match) => match[1]),
      migrations: files.filter((file) =>
        /^apps\/server\/prisma\/migrations\/.*\/migration\.sql$/.test(file),
      ),
      guidance: files.filter((file) =>
        /(^|\/)AGENTS\.md$|^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(file),
      ),
      references: [
        'docs/architecture.md',
        'docs/agent-workflow.md',
        'docs/auth.md',
        'docs/deployment.md',
      ],
    },
    null,
    2,
  ),
);
