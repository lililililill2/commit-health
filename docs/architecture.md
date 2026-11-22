# Code map

Use this map to navigate the current checkout. The initial analysis used `e78c758`;
confirm current versions and implementation scope with `pnpm agent:context` and the linked source.
Do not treat features on another branch or plans from a conversation as implemented here.

## Workspace and stack

| Location                   | Responsibility and source                                                   |
| -------------------------- | --------------------------------------------------------------------------- |
| `apps/web`                 | Next.js App Router, React, TypeScript. [Manifest](../apps/web/package.json) |
| `apps/server`              | NestJS, Express, ESM/NodeNext. [Manifest](../apps/server/package.json)      |
| `docs`                     | Auth, deployment, and development guidance; the root README stays brief     |
| `.agents/skills`           | Repository-specific workflows                                               |
| `scripts/agent`            | Context discovery, harness checks, verification without secret files        |
| `.github/workflows/ci.yml` | Quality/build checks and separate PostgreSQL integration tests              |

[pnpm-workspace.yaml](../pnpm-workspace.yaml) includes the two `apps/*` packages; there is no shared package.
The root [manifest](../package.json) specifies Node 24, pnpm 10, and Turbo 2.
The web uses Next 16/React 19, Tailwind 4, TanStack Query 5, Axios, Three/R3F/Drei.
The server uses Nest 12, Prisma 7 with `@prisma/adapter-pg`, `pg`, and `openid-client`.
Read manifests/lockfile for exact versions instead of maintaining duplicate version lists. Zustand is not installed.

## Web entry points

1. [Root layout](../apps/web/app/layout.tsx) and [AppProviders](../apps/web/src/app/providers/query-provider.tsx): styles and QueryClient lifecycle.
2. `app/**/page.tsx`: routes and metadata composing FSD pages.
3. `src/pages`: screens; `widgets`: dorm/HUD; `features`: auth and 3D interaction;
   `entities/session`: session data; `shared`: Axios and utilities.
4. [ESLint](../apps/web/eslint.config.mjs) restricts upward/same-layer imports and slice deep imports by alias.
   Use `index.ts` public APIs. Keep [pages/README.md](../apps/web/pages/README.md) to prevent router conflicts.

| Route                                  | Current behavior                                                 | Source                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `/`                                    | Session lookup: loading, connection error, Google login, or dorm | [HomePage](../apps/web/src/pages/home/ui/home-page.tsx)                                    |
| `/3d-preview`                          | Public 3D preview                                                | [Route](../apps/web/app/3d-preview/page.tsx)                                               |
| `/auth/error`                          | Auth failure guidance                                            | [Route](../apps/web/app/auth/error/page.tsx)                                               |
| `/settings`                            | Protected settings and logout                                    | [SettingsPage](../apps/web/src/pages/settings/ui/settings-page.tsx)                        |
| `/commit`, `/records`, `/achievements` | Protected placeholders with a title and back link                | [MenuPlaceholderPage](../apps/web/src/pages/menu-placeholder/ui/menu-placeholder-page.tsx) |

[DormStage](../apps/web/src/widgets/dorm-stage/ui/dorm-stage.tsx) overlays menus, a clock, and glass header/footer on 3D,
hiding UI during rotation. [DormHud](../apps/web/src/widgets/dorm-stage/ui/dorm-hud.tsx) shows static quests with no completion API.
[DormCanvas](../apps/web/src/features/dorm-viewer/ui/dorm-canvas.tsx) provides client-only Canvas, WebGL error handling,
`useGLTF`, camera limits, and damping. [view-config.ts](../apps/web/src/features/dorm-viewer/model/view-config.ts)
centers and measures `public/models/dorm.glb`, fits the camera, and disables zoom.

## Server, authentication, and transport

[main.ts](../apps/server/src/main.ts), [AppModule](../apps/server/src/app.module.ts), and
[configureApp](../apps/server/src/config/configure-app.ts) configure startup, `/api`, ValidationPipe, and CORS.
Current feature modules are `health` and `auth`. [AuthModule](../apps/server/src/modules/auth/auth.module.ts)
registers SessionGuard as `APP_GUARD`, requiring authentication by default.

See [auth.md](auth.md) for the auth contract and cookie policy. Relevant implementation:

- [AuthController](../apps/server/src/modules/auth/auth.controller.ts): Google start/callback, me/logout/activity, failure stages.
- [GoogleOidcService](../apps/server/src/modules/auth/google-oidc.service.ts): Authorization Code, PKCE/state/nonce, ID token validation; only `openid` scope.
- [AuthService](../apps/server/src/modules/auth/auth.service.ts): OAuth attempt storage/consumption, sub-based upsert, session hashes, expiry/renewal.
- [SessionGuard](../apps/server/src/modules/auth/session.guard.ts): session validation and Origin/CSRF for mutations.
- [Session query](../apps/web/src/entities/session/model/session.ts): only 401 maps to anonymous; other failures remain query errors.
- [Axios](../apps/web/src/shared/api/instance.ts): credentials and a 5-second timeout; default localhost:8080/api in development, `/api` in production.
- [Next config](../apps/web/next.config.ts): HTTPS `/api` rewrite when `API_SERVER_ORIGIN` is set; auth no-store/no-referrer headers.

Sessions last 24 hours from the last confirmed real activity; automatic queries do not renew them.
This policy is separate from investigating concurrent login starts or DB latency.
`unexpected_failure` alone cannot establish a cause; hypotheses are not automatic fix targets.

## Database and extension points

[schema.prisma](../apps/server/prisma/schema.prisma) defines `User`, `Session`, and `OAuthAttempt`.
There is one migration, `20261026015130_google_auth`; source files do not prove its application to a live DB.
User stores only Google sub, an internal ID, and timestamps. This checkout has no health-record, character,
achievement, or app-connection models.

[PrismaService](../apps/server/src/prisma/prisma.service.ts) lazily creates the runtime client using the pooled connection.
[prisma.config.ts](../apps/server/prisma.config.ts) prefers the direct connection for the normal CLI.
[Test configuration](../apps/server/prisma.test.config.ts) uses a separate connection and validates the DB name,
which does not establish host safety or replace target approval.

Future records can use new Nest modules/Prisma models and corresponding FSD slices.
Constrain ownership using server-validated identity. Quest completion, health analysis, and app linking
need contracts before implementation; their absence alone is not a bug or vulnerability.

## Quality and deployment

- [Turbo](../turbo.json): generated-client dependencies, app-specific build outputs/environment, development environment forwarding. Remote cache is disabled.
- [CI](../.github/workflows/ci.yml): PRs, main pushes, and manual runs. Quality checks cover formatting, lint, types, unit/HTTP tests, Prisma validation, and builds, plus one harness-check step. The DB job applies migrations and tests against disposable PostgreSQL 17.
- Web tests use Node's runner with an explicit file list. Server tests use Jest/ts-jest ESM with separate HTTP/DB configurations.
- [.prettierrc](../.prettierrc) and [.editorconfig](../.editorconfig): single quotes, semicolons, width 100, two-space indentation, LF.
- [.coderabbit.yaml](../.coderabbit.yaml) configures Korean reviews. Validate findings against code and reproduction.
- [Web](../apps/web/vercel.json) and [server](../apps/server/vercel.json) Vercel projects build through Turbo at the workspace root. See [deployment.md](deployment.md) for approval and sequencing. Local configuration cannot confirm dashboard variables, Git integration, or successful deployment.
