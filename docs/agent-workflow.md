# AI development harness

## Design

- Root [AGENTS.md](../AGENTS.md) holds shared conventions and permissions; app guides cover FSD and Nest specifics.
- The [code map](architecture.md) links entry points. Auth and deployment policies remain in their existing documents.
- `.agents/skills` contains three task-specific workflows: feature development, auth investigation, and verification. Load only the relevant one.
- No persistent custom subagents are configured. App guides suffice for two apps. When parallel work is explicitly requested, separate web/server/read-only review ownership and assign one agent final verification.
- No new MCP server, hook, model/permission configuration, API key, or automatic deployment is introduced. Use existing GitHub connections for PR/issue work and Figma for design tasks. Do not connect a DB MCP by default.
- Instructions and the temporary verification copy are not a security sandbox for malicious code/packages. Execution permissions and approvals still apply.

## Getting started

From the repository root, run:

```sh
pnpm agent:context
pnpm agent:check
```

Use `pnpm.cmd` if PowerShell blocks `pnpm.ps1`.
`agent:context` reports the current branch/HEAD, changed filenames, manifest versions, route/model lists,
and guidance paths without reading environment files, logs, secret values, or remote services.
The root README stays brief; this document is the harness entry point.

Skills can be selected automatically or invoked explicitly:

- `$commit-health-feature Implement sleep records. Inspect the current implementation first; do not access production DBs.`
- `$commit-health-auth-debug Investigate login failures. Separate facts from hypotheses; do not edit code.`
- `$commit-health-verify Verify current changes, including builds. Do not commit or push.`

If new Skills are missing, open a new project session and check again.
For agents without automatic discovery, request that they read root AGENTS and the relevant SKILL file.
This repository does not duplicate other agents' configuration or guarantee their automatic discovery.
User-facing reports remain in Korean, as specified in root AGENTS.

## Verification

| Scope                          | Command                                               | Coverage                                                                                |
| ------------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Instructions/Skills/harness    | `pnpm agent:check`                                    | Links, Skill metadata, command wiring, Git exclusions, harness regression tests         |
| Web                            | `pnpm agent:verify --scope web`                       | Web lint/typecheck/test in a temporary copy                                             |
| Server                         | `pnpm agent:verify --scope server`                    | Server lint/typecheck/unit/HTTP checks and Prisma generate/validate in a temporary copy |
| Shared configuration/both apps | `pnpm agent:verify --scope all --build`               | Both apps and production builds                                                         |
| Preview commands               | `pnpm agent:verify --scope all --build --dry-run`     | Print the plan without copying, installing, or building                                 |
| Real DB                        | Existing CI `database` job or approved `pnpm test:db` | Dedicated PostgreSQL migrations/data writes; excluded from default verification         |

Add `--build` to any app scope to build it. The runner reuses package scripts and Turbo configuration.
It provides a separate local execution location, not another CI pipeline.
CI adds only `agent:check`; existing app checks and the DB job remain unchanged.

### Temporary verification

1. Copy Git-tracked and nonignored untracked source paths. Verify **current working-tree contents**, not the staged version; omit deleted files.
2. Exclude real `.env`/`.env.*` files (retain examples), keys, private tooling configuration, logs, and generated output before reading their contents. Reject symlinks/junctions rather than following them.
3. Pass only required OS paths and public test configuration, not the full inherited environment. Use empty temporary npm settings and temporary Turbo/Vercel configuration paths. Supply no real Google/DB credentials.
4. Run `pnpm install --frozen-lockfile --ignore-scripts --offline`, required Prisma generation, and existing checks. Cache misses fail; use `--online` when public registry downloads are permitted. Do not automatically update the lockfile.
5. Build Next rewrites with a fake API origin. This does not verify Vercel connectivity, Google login, databases, or browser/WebGL behavior. Report build-time external-data requirements as a separate limitation.
6. Remove only this run's temporary directory on exit. Leave original source, `.next`, `dist`, and development servers untouched. If forced termination prevents cleanup, inspect the printed temporary path before manual removal.

Path/environment restrictions reduce accidental secret exposure; they are not a complete secret scanner
and do not guarantee detection of credentials hardcoded in source. Actual secret access still needs approval.
The DB-test URL validator checks the database name only; confirm the authorized target separately.

### Failure recovery

Record the failing command, a sanitized error, and the likely cause. Before retrying, identify what changed or what new evidence the run will provide. A deterministic failure can be investigated immediately.

After the same failure occurs three times, stop that retry loop. Document the evidence and attempted fixes, then try a different diagnostic if it can provide new evidence. Continue independent work and report any blocker that remains, including what evidence or user action would resolve it.

## Context and maintenance

For work expected to span sessions, keep one short `.verification/progress/<task>.md` file per task. This directory is Git ignored and excluded from verification snapshots. Update the file after meaningful milestones and before a handoff. On resume, confirm the branch, HEAD, and current diff before using the notes. Keep secrets and raw logs out of the file.

```text
Goal / current branch and HEAD / existing user changes
Verified code and decisions / remaining hypotheses
Changed files / executed checks and results
Next steps / unverified DB, browser, or deployment behavior / authorized scope
```

Update relevant source links when paths, commands, or features change. Query versions and file lists with `agent:context`.
Add Skills for demonstrated recurring work. Automated checks validate format, references, and execution,
not an agent's adherence in every situation or its automatic Skill selection.

## Official references

Checked when the harness was created on 2026-11-20:

- [AGENTS.md scope and instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [Skills and `.agents/skills` discovery](https://learn.chatgpt.com/docs/build-skills)
- [Subagents and role configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [MCP connections and project configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Configuration-directory overrides in the installed Turbo version](https://github.com/vercel/turborepo/blob/v2.11.10/crates/turborepo-dirs/src/lib.rs)

Personal `.codex/config.toml` is not modified; repository sandbox/model/MCP settings are not forced.
