# Commit Health

## 프로젝트 소개

건강한 생활 습관을 기록하고 캐릭터를 성장시키는 개인 건강 관리 웹 서비스입니다.
현재는 초기 개발 환경만 구성되어 있으며 인증, 건강 기록, 퀘스트 등 서비스 기능은 구현하지 않았습니다.

## 사용 기술

- Node.js 24.x (검증 환경 24.15.0), pnpm 10.30.3 workspace
- Next.js 16.4.3, React 19.3.1, TypeScript 5.9.3, App Router, FSD
- Tailwind CSS 4.3.3, TanStack Query 5.104.5, Axios 1.20.0, Pretendard 1.3.9
- NestJS 12.2.0, @nestjs/config 12.0.1, class-validator 0.15.1, class-transformer 0.5.1
- Prisma 7.10.1, PostgreSQL (`@prisma/adapter-pg` 7.10.1, `pg` 8.23.1)
- ESLint 9.39.5, Prettier 3.9.10, Jest 30.5.2, ts-jest 29.4.15, Supertest 7.3.1

전체 직접 의존성은 각 `package.json`, 정확한 의존성 트리는 `pnpm-lock.yaml`에서 확인합니다.

## 프로젝트 폴더 구조

```text
commit-health/
├── apps/
│   ├── web/
│   │   ├── app/                 # Next.js 라우트와 루트 layout
│   │   ├── pages/               # src/pages의 Pages Router 오인 방지
│   │   └── src/
│   │       ├── app/             # Provider, 전역 스타일
│   │       ├── pages/home/      # 메인 페이지 UI
│   │       └── shared/api/      # Axios 인스턴스, Health API
│   └── server/
│       ├── prisma/             # Schema, migration 경로
│       ├── prisma.config.ts    # Prisma CLI 연결 설정
│       ├── src/
│       │   ├── config/         # 환경변수 검증, CORS, ValidationPipe
│       │   ├── modules/health/ # DB와 독립적인 Module/Controller/Service
│       │   ├── prisma/         # DB 기능에서 import할 PrismaModule/Service
│       │   └── generated/      # Prisma Client (자동 생성, Git 제외)
│       └── test/               # HTTP 통합 테스트
├── docs/                       # 향후 설계 문서
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

사용하지 않는 FSD `widgets`, `features`, `entities`와 백엔드 `common` 폴더는 필요할 때 추가합니다.
FSD는 `app → pages → widgets → features → entities → shared` 방향으로만 의존합니다.
slice 외부에서는 `index.ts` public API를 사용하고, slice 내부에서는 상대 경로를 사용합니다.
`@/*`는 `apps/web/src/*`를 가리킵니다. ESLint에 레이어 역방향 import와 slice 내부 경로 import 제한을 적용했습니다.
`app`과 `shared` 내부는 segment 간 import가 가능합니다.

## 실행 방법

Node.js 24.x와 pnpm 10.30.3이 필요합니다. 루트에서 한 번 설치하고 두 터미널에서 각각 실행합니다.

```bash
pnpm install
pnpm dev:server
pnpm dev:web
```

- 프론트엔드: http://localhost:3000
- 백엔드: http://localhost:8080/api/health
- Health 응답: `{"status":"ok","service":"commit-health-server"}`
- 개별 실행: 각 앱 폴더에서 `pnpm dev`
- Windows PowerShell에서 `pnpm.ps1` 실행이 제한되면 동일 명령의 `pnpm`을 `pnpm.cmd`로 바꿉니다.

Prisma Client는 의존성 설치와 서버의 개발 실행, 타입 검사, 빌드 전에 자동 생성됩니다.
Health 모듈은 PrismaModule을 import하지 않으므로 PostgreSQL 없이도 두 앱을 실행할 수 있습니다.
API 연결 상태는 브라우저에서 TanStack Query와 공용 Axios 인스턴스로 실제 요청한 결과입니다.
Pretendard는 설치한 패키지의 폰트를 자체 제공하므로 외부 폰트 CDN을 요청하지 않습니다.

## 환경변수 설정 방법

각 예제 파일을 복사한 뒤 로컬 값으로 수정합니다. 기본 웹/서버 실행에는 복사 없이도 개발 기본값을 사용합니다.

```powershell
Copy-Item apps/web/.env.example apps/web/.env.local
Copy-Item apps/server/.env.example apps/server/.env
```

| 파일                  | 변수                       | 기본값 / 용도                                        |
| --------------------- | -------------------------- | ---------------------------------------------------- |
| `apps/web/.env.local` | `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8080/api`                          |
| `apps/server/.env`    | `NODE_ENV`                 | `development`                                        |
| `apps/server/.env`    | `PORT`                     | `8080`                                               |
| `apps/server/.env`    | `CORS_ORIGIN`              | `http://localhost:3000` (여러 origin은 쉼표로 구분)  |
| `apps/server/.env`    | `DATABASE_URL`             | 선택 사항. PostgreSQL 연결 및 migration 실행 시 필요 |

`NEXT_PUBLIC_*`는 브라우저 번들에 포함됩니다. 비밀정보를 넣지 마세요.
로컬 `.env*`는 Git에서 제외하며 `.env.example`만 관리합니다. 웹 환경변수 변경 후 개발 서버를 다시 실행하고 배포용 번들은 다시 빌드합니다.

DB 작업을 시작할 때 PostgreSQL 서버와 전용 개발 데이터베이스를 준비하고 서버 `.env`의 `DATABASE_URL`을 설정합니다.
실제 자격 증명으로 예제의 주석을 해제하고 수정하세요. PostgreSQL 설치는 기본 실행에 필수가 아닙니다.
데이터 모델이 결정되면 `apps/server/prisma/schema.prisma`에 추가한 뒤 실행합니다.

```bash
pnpm prisma:validate
pnpm prisma:generate
pnpm prisma:migrate --name init
pnpm prisma:generate
pnpm prisma:studio
```

Prisma 7은 연결 URL을 `prisma.config.ts`에서 읽고 `prisma-client`로 `src/generated/prisma`에 Client를 생성합니다.
NestJS 12의 ESM 모듈에 맞춰 `moduleFormat = "esm"`을 지정했습니다.
DB가 필요한 Nest 모듈에서만 `PrismaModule`을 import합니다. `PrismaService`는 `PrismaPg` 어댑터를 사용하고
첫 쿼리 시 연결하며 앱 종료 시 해제합니다. 현재 Schema에는 도메인 모델과 초기 migration이 없습니다.
DB 서버와 모델 준비 전에는 migration을 실행하지 않습니다. 기존 migration 적용은 `pnpm prisma:deploy`로 실행합니다.

## 빌드 및 테스트 방법

```bash
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test
pnpm test:e2e
pnpm prisma:validate
pnpm build
```

단위 테스트는 환경변수의 기본값과 잘못된 설정을 검증합니다.
HTTP 통합 테스트는 DB 없이 Health 응답, `/api` prefix, CORS, DTO 검증, 기본 예외 응답을 확인합니다.
Jest의 ESM 지원을 위해 테스트 스크립트에 `--experimental-vm-modules`를 지정했습니다.
서버는 Nest 기본 예외 필터를 사용하며 별도의 오류 계약은 추후 결정합니다.

빌드 후 각 앱 폴더에서 `pnpm start`로 실행합니다. 서버는 8080, 웹은 3000을 사용합니다.
DB 작업을 제외한 위 검사는 PostgreSQL 연결 없이 실행할 수 있습니다.
