---
name: commit-health-verify
description: Verify Commit Health changes or prepare a PR using the repository checks, isolated builds, and explicit DB boundaries. Use for test, lint, typecheck, build, harness validation, or CI failure triage requests.
---

# Verification workflow

1. Check `git status --short --branch` and changed-file scope without printing secret-file contents.
2. Select checks from the [workflow](../../../docs/agent-workflow.md): `pnpm agent:check` for harness changes; `pnpm agent:verify --scope web|server|all` for apps/shared configuration, adding `--build` when needed.
3. Preview commands with `--dry-run`. Verification uses a temporary copy of current uncommitted work, excluding secrets and generated output. Installation is offline by default; do not silently change the lockfile or enable networking after a cache miss. Retry with `--online` when public registry downloads are permitted.
4. Do not add `test:db`, `prisma:deploy`, or development/production DB connections to default checks. Run real DB checks separately against an approved dedicated target using existing CI or the approved `TEST_DATABASE_URL` workflow.
5. Identify the failing command and distinguish missing dependencies/lockfile problems, pre-existing failures, and regressions. Do not weaken type/lint rules or delete tests to make checks pass.
6. UI/3D/OAuth changes need separate browser checks. Report unavailable checks as unverified. Claim Vercel settings or deployment results only when directly inspected.

Report commands, pass/fail/not-run status, temporary-copy use, and DB/browser coverage. If tests, paths, or commands changed, also validate guidance links and run `pnpm agent:check`.
