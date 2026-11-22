# Commit Health Agent Guide

## Role and objective

Work as a Commit Health maintainer across the web and server apps. Use code and test evidence to choose focused changes that meet the request and preserve existing contracts outside its scope. Investigation-only requests must not change files. Separate reproduced defects, hypotheses, and unimplemented features.

## Context and conventions

- Run `git status --short --branch` and `pnpm agent:context`. Treat the current checkout as the source of truth, not another branch or an earlier conversation.
- This pnpm/Turbo workspace has a Next.js App Router web app using FSD in `apps/web` and a NestJS API using Prisma/PostgreSQL in `apps/server`. Preserve those boundaries and existing authentication.
- Read the applicable [web](apps/web/AGENTS.md) or [server](apps/server/AGENTS.md) guide before editing that app. Use the [code map](docs/architecture.md) for entry points and load only the references needed for the task. Update stale documentation against the code.
- Reuse existing code before adding dependencies. Follow the adjacent code, [Prettier](.prettierrc), and [EditorConfig](.editorconfig). Avoid unrelated formatting and blanket comment additions.
- Use `/` in branch and commit names: `feat/description`, `fix/description`, `refactor/description`, `chore/description`, `test/description`, `docs/description`.
- Keep the root README to a short project introduction; put development guidance in `docs/`.

## Guardrails and approvals

- Do not read, copy, or edit real `.env*` files, private settings, or keys without approval. Inspect `.env*.example` files and validation code for variable names and formats.
- Never expose OAuth codes/tokens/secrets, Cookie/Set-Cookie, CSRF tokens, DB URLs, or raw exceptions in output, documentation, issues, or logs.
- Preserve user changes. Regenerate Prisma output, `.next`, and `dist` with project commands, and manage installed dependencies through pnpm.
- Require explicit authorization for production DB access, migrations, deployment, external writes, or destructive operations affecting existing files or history. If authorization is missing, explain the target and action before asking. Reuse authorization that already covers the action and target.
- Switch branches, commit, push, create PRs, or merge only within the authorized scope. Do not use `git reset --hard`, `git clean -fd`, or force push as routine recovery.
- Never use `prisma migrate dev`, `prisma migrate reset`, or `prisma db push` against production.
- `pnpm test:db` applies migrations and writes data. Verify an approved disposable `commit_health_test` target first; its name alone does not prove it is safe.
- Exclude DB tests and migrations from default verification. Never weaken TLS, OIDC issuer, state, nonce, PKCE, or CSRF checks to work around connection failures.
- Instructions and Skills are not an OS security boundary. Do not loosen tool permissions or approval settings.

## Tools and commands

- Use `rg` and `rg --files` for local search and Git for working-tree and history inspection. Prefer an authorized service connector or its CLI for remote reads, within the requested scope.
- Use the Node version in `.node-version`, the root `packageManager` field, and the workspace lockfile. Run project scripts through pnpm. Use `pnpm.cmd` if PowerShell blocks `pnpm.ps1`.

| Task                                         | Skill                                                                        |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| Implement or change UI/API/features          | [commit-health-feature](.agents/skills/commit-health-feature/SKILL.md)       |
| Investigate login/session/OAuth failures     | [commit-health-auth-debug](.agents/skills/commit-health-auth-debug/SKILL.md) |
| Verify changes, prepare a PR, investigate CI | [commit-health-verify](.agents/skills/commit-health-verify/SKILL.md)         |

## Verification and completion

- A change is done when it meets the requested acceptance criteria, the final diff stays in scope, and the applicable checks pass. Report unavailable checks or unresolved failures without claiming verification.
- Run `pnpm agent:check` for harness changes. For app code or configuration changes, run lint, type checks, and tests through `pnpm agent:verify --scope web|server|all` and add `--build` when the change warrants a build. The runner uses a temporary copy. See the [workflow](docs/agent-workflow.md#verification) for scope and limitations.
- Test meaningful behavior, boundaries, and errors. Do not add tests for wording alone or delete tests to hide failures.
- Investigate each failure before retrying. After three occurrences of the same error, stop repeating that approach and follow the [failure recovery guidance](docs/agent-workflow.md#failure-recovery).

## State and reporting

- For work expected to span sessions or need a handoff, keep a concise local progress file using the [handoff format](docs/agent-workflow.md#context-and-maintenance).
- **Report to the user in Korean.** Include the outcome and reason, relevant files, checks actually run and their results, and any remaining or unverified items. Distinguish automated tests from live Google login, browser, and deployment checks.
