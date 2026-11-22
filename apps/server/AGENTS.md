# Server Guide

Apply alongside the root [AGENTS.md](../../AGENTS.md).

## Code and APIs

- Add Nest features as controller/service/module under `src/modules/<feature>` and register them in `AppModule`. Keep HTTP handling in controllers and business logic in services.
- The server uses ESM + NodeNext. Keep `.js` extensions in relative TypeScript import specifiers. Do not use `import type` for classes required by runtime DI.
- `src/config/configure-app.ts` owns `/api`, DTO whitelisting/transformation/extra-field rejection, and CORS. Do not introduce unrelated global filters or response formats.
- `SessionGuard` is global. Mark only public routes with `@Public()`. Obtain identity from `@CurrentUser()` or validated `request.auth`; constrain user-data queries by owner.
- Preserve Origin + CSRF for mutations, Google sub identity, OIDC validation, and session invalidation. See [auth.md](../../docs/auth.md).

## Prisma and tests

- Prisma 7 generates the client in `src/generated/prisma`. Edit `prisma/schema.prisma` and `prisma/migrations`, not generated code.
- Runtime `PrismaService` uses `DATABASE_URL`; the normal CLI uses `DATABASE_URL_UNPOOLED || DATABASE_URL`. Generation/validation need no DB connection.
- CLI dotenv and Nest ConfigModule can read `.env`. Without secret-file approval, use `pnpm agent:verify --scope server --build`, which excludes those files.
- Review SQL and existing-data impact before schema changes. Do not rewrite applied migrations or run `migrate dev`, `db push`, or reset in production. See [deployment.md](../../docs/deployment.md).
- Jest ESM uses `src/**/*.spec.ts` for unit tests, `test/*.e2e-spec.ts` for HTTP tests without a DB, and `test/*.db-spec.ts` for real DB tests. Import test globals explicitly from `@jest/globals` in new tests.
- DB tests use only `TEST_DATABASE_URL` through `prisma.test.config.ts` and `test/helpers/test-database.ts`, never a development-connection fallback. Scope and clean up test-owned data in the dedicated DB.
- `test:db` includes migrations. Default harness verification excludes it; CI has a separate PostgreSQL job. Confirm target and authorization before local DB checks.
- Auth regression tests should cover the affected cases: success, unauthenticated/CSRF rejection, expired/logged-out sessions, duplicate-user prevention, and cross-user access denial.
