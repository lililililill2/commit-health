# Commit Health

건강한 생활 습관을 기록하고 캐릭터를 성장시키는 개인 건강 관리 서비스입니다.

## 실행 방법

Node.js 24.x, pnpm 10.30.3, PostgreSQL을 준비합니다.

```bash
cp -n apps/server/.env.example apps/server/.env
cp -n apps/web/.env.example apps/web/.env.local
```

개발 DB를 생성하고 `apps/server/.env`에 `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`을 설정합니다.
Google OAuth 설정은 [인증 안내](docs/auth.md)를 참고합니다.

```bash
pnpm install
pnpm prisma:deploy
pnpm dev
```

- 프론트엔드: http://localhost:3000
- 백엔드: http://localhost:8080/api/health
- 개별 실행: `pnpm dev:web`, `pnpm dev:server`
