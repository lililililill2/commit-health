---
name: commit-health-feature
description: Implement or change a Commit Health UI, API, or user feature using the existing FSD and NestJS structure, with a scoped contract and verification. Use for implementation requests, not investigation-only requests.
---

# Feature workflow

1. Run `pnpm agent:context` at the root. Check the current implementation using entry points in the [code map](../../../docs/architecture.md).
2. Read the [web](../../../apps/web/AGENTS.md) or [server](../../../apps/server/AGENTS.md) guide for the area being changed; read both only for cross-app work.
3. Define inputs, responses, ownership, loading/error states, and completion criteria. Distinguish server data from temporary UI state; placeholders and static quests are not implemented services.
4. Extend existing slices/modules/public APIs. Compose FSD pages from Next routes and keep user APIs under the global guard. Separate code/SQL preparation from applying DB changes.
5. Add meaningful regression coverage for changed behavior. Prefer existing checks and browser verification for simple presentation changes. Register new web tests in the package script's file list.
6. Run checks for the changed scope using the [verification workflow](../../../docs/agent-workflow.md). Distinguish pre-existing failures from regressions.

Report changes, files, checks, and unimplemented/unverified items. Do not proceed to commit, push, or deploy unless requested.
