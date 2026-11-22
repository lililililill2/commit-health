---
name: commit-health-auth-debug
description: Investigate Commit Health Google OAuth, session restoration, logout, or intermittent login failures using code and sanitized evidence. Use when login fails or an auth review needs validation; distinguish reproduction from hypotheses before proposing a fix.
---

# Auth investigation

Start with [auth.md](../../../docs/auth.md) and auth entry points in the [code map](../../../docs/architecture.md). Investigation-only requests must not change files; when fixes are requested, stay within established causes.

1. Identify the current branch, symptom, and failing request. Read public configuration code/examples instead of real environment files. Explain the need and scope before requesting access to actual values.
2. Trace browser → Axios or navigation → proxy → Nest guard → OAuth/DB. Distinguish `/auth/me` 401, the 5-second timeout, connection refusal, and CORS failures. Axios timeout does not apply to login-link navigation.
3. Read the current stage assignments and catch scope in `auth.controller.ts`. `attempt_storage` includes DB storage and subsequent cookie/redirect operations. `unexpected_failure` does not establish a Neon cold start or a Prisma error code. `/auth/me` guard failures may not appear in this controller's logs.
4. Startup success does not prove later connectivity. Distinguish SSL warnings from TLS failures and Next HMR origin warnings from auth API failures. Verify that `resolveSession` without a cookie skips DB access in the current code.
5. Reproduce with unit/local HTTP checks first. Label evidence as mocks, injected latency, a local signed OIDC provider, real Google, or production logs. Real DB reproduction requires an approved dedicated test target.
6. Report only safe stages, allowlisted error codes, HTTP status, timing, and reproduction conditions. Never output raw exceptions, callback queries, cookies/tokens, connection strings, or raw HAR files. Do not weaken issuer/state/nonce/PKCE/TLS/CSRF validation.

Report **facts with file locations → hypotheses → minimal proposed fix → unverified items**. Confirm existing issue status through tools before asserting it. Issue/comment creation and production operations remain limited to the user's authorization.
