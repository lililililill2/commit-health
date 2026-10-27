# Vercel 운영 로그인 배포

로그인 첫 화면은 Figma의 `logo!!!!!!!!` 레이어 원본과 Google 공식 아이콘을 로컬 자산으로 사용합니다.
Figma 파일 전체 랜딩 페이지를 구현한 것은 아니며, 화면은 로고와 로그인 버튼 중심으로 구성합니다.

## 웹 프로젝트 설정

| 항목             | 값                                                                       |
| ---------------- | ------------------------------------------------------------------------ |
| Framework Preset | Next.js                                                                  |
| Root Directory   | `apps/web`                                                               |
| Node.js Version  | `24.x`                                                                   |
| Install Command  | 자동 감지 사용 (Override 끄기)                                           |
| Build Command    | `pnpm --workspace-root exec turbo run build --filter=@commit-health/web` |
| Output Directory | Next.js 기본값 (`.next`)                                                 |

빌드 명령은 `apps/web/vercel.json`에 정의했습니다. Vercel에 `apps/web`을 프로젝트 Root Directory로 지정하고,
Root Directory 밖의 소스를 빌드에 포함하는 설정을 켭니다. 루트의 `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
`package.json`, `turbo.json`이 빌드 환경에 필요합니다.
`--workspace-root`는 pnpm의 실행 위치를 워크스페이스 루트로 지정하며, Vercel의 파일 접근 제한을 해제하는 옵션은 아닙니다.

Install Command는 `vercel.json`과 Vercel 대시보드 모두에서 오버라이드하지 않습니다.
Vercel은 lockfile을 기반으로 pnpm을 자동 감지하지만, lockfile 형식 `9.0`만으로 정확한 pnpm 버전까지 보장하지는 않습니다.
현재 루트 `package.json`의 `packageManager`는 `pnpm@10.30.3`입니다. 이를 배포에서도 사용하려면 Vercel의
Preview/Production 환경변수에 `ENABLE_EXPERIMENTAL_COREPACK=1`을 설정하고, 배포 로그에서 실제 pnpm 버전을 확인합니다.

## 서버 프로젝트와 DB

NestJS는 별도 Vercel 프로젝트 `commit-health-api`로 구성합니다.
Root Directory는 `apps/server`, Framework는 NestJS, Node.js는 `24.x`이며 루트 밖 소스 포함을 켭니다.
`apps/server/vercel.json`의 빌드 명령은 `pnpm --workspace-root exec turbo run build --filter=@commit-health/server`입니다.
웹과 마찬가지로 설치 명령 자동 감지와 `ENABLE_EXPERIMENTAL_COREPACK=1`을 사용합니다.

운영 PostgreSQL은 개발·자동 테스트 DB와 분리한 관리형 DB를 사용합니다.
Neon을 연결할 경우 무료 플랜, Singapore(`sin1`) 리전, production 환경만 선택하고 Neon Auth와 Realtime은 사용하지 않습니다.
서버 함수도 같은 리전으로 구성합니다. 운영 DB가 준비되면 해당 연결에 `pnpm prisma:deploy`로 기존 migration을 적용합니다.
DB 초기화나 개발 DB migration을 운영 배포의 일부로 실행하지 않습니다.
서버 Preview 배포는 별도 DB와 OAuth 환경을 준비할 때까지 비활성화합니다.

## 같은 사이트에서 인증하기

브라우저는 웹의 `/api`로 요청하고, Next.js rewrite가 서버 프로젝트로 전달합니다.
Google callback도 웹 주소를 사용하므로 HttpOnly 세션 쿠키를 웹 사이트에 유지할 수 있습니다.
웹의 `API_SERVER_ORIGIN`이 설정된 경우에만 rewrite를 활성화하며, HTTPS origin만 허용합니다.
인증 경로는 `no-store`와 `no-referrer`를 설정하고 Vercel rewrite 캐시도 비활성화합니다.

웹 프로젝트의 production 환경변수:

| 변수                           | 값                                                                 |
| ------------------------------ | ------------------------------------------------------------------ |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`                                                                |
| `NEXT_PUBLIC_API_BASE_URL`     | `/api`                                                             |
| `API_SERVER_ORIGIN`            | 서버 프로젝트의 실제 HTTPS Production origin. `/api`는 붙이지 않음 |

`NEXT_PUBLIC_API_BASE_URL`과 rewrite 대상은 빌드할 때 반영되므로 변경 후 다시 배포합니다.
Turbo 캐시도 `API_SERVER_ORIGIN` 변경을 반영합니다.
운영 빌드에서 공개 API 변수가 없을 때의 기본값은 `/api`이며, 개발 기본값은 `http://localhost:8080/api`입니다.

서버 프로젝트의 production 환경변수:

| 변수                                       | 값                                                          |
| ------------------------------------------ | ----------------------------------------------------------- |
| `ENABLE_EXPERIMENTAL_COREPACK`             | `1`                                                         |
| `NODE_ENV`                                 | `production`                                                |
| `FRONTEND_URL`                             | `https://commit-health.vercel.app`                          |
| `CORS_ORIGIN`                              | `https://commit-health.vercel.app`                          |
| `GOOGLE_CALLBACK_URL`                      | `https://commit-health.vercel.app/api/auth/google/callback` |
| `COOKIE_SAME_SITE`                         | `lax`                                                       |
| `DATABASE_URL`                             | 운영 Neon pooled 연결. NestJS 실행 시 사용                  |
| `DATABASE_URL_UNPOOLED`                    | 같은 DB의 direct 연결. Prisma CLI 마이그레이션에 우선 사용  |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | 운영용 Google OAuth 웹 클라이언트. 서버에만 등록            |

Google Cloud에도 위 callback을 정확히 등록합니다. 운영 클라이언트는 개발용과 분리합니다.
OAuth 클라이언트 유형은 **웹 애플리케이션**으로 선택합니다.

| Google Cloud 항목      | 운영 등록값                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| 승인된 JavaScript 원본 | `https://commit-health.vercel.app` (현재 서버 Authorization Code Flow에서는 필수 아님) |
| 승인된 리디렉션 URI    | `https://commit-health.vercel.app/api/auth/google/callback`                            |

현재 로그인은 Google 브라우저 SDK 대신 백엔드 OIDC 라이브러리를 사용합니다.
JavaScript 원본을 입력할 때는 위 웹 origin만 등록하며 `/api`나 callback 경로를 붙이지 않습니다.
리디렉션 URI에는 쿼리·fragment·마지막 `/`를 추가하지 않습니다. 이 구성에서는 별도 서버 도메인을 callback으로 등록하지 않습니다.
인증 시작과 코드 교환 모두 동일한 `GOOGLE_CALLBACK_URL`을 사용하고, 실제 토큰 검증과 세션 발급은 NestJS가 처리합니다.

로컬 입력이 필요하면 `apps/server/.env.production.example`을 `.env.production`으로 복사합니다.
이 파일은 직접 지정한 배포 작업용이며, 개발 서버의 `.env` 대신 자동으로 로드하지 않습니다.
실제 환경파일·Google 시크릿·DB 연결 문자열은 Git과 웹 번들에 포함하지 않습니다.

## 운영 마이그레이션과 최초 배포 순서

Prisma 7 CLI는 `DATABASE_URL_UNPOOLED`가 있으면 사용하고, 없거나 빈 값이면 기존 `DATABASE_URL`을 사용합니다.
로컬 `.env`에 unpooled 변수를 추가할 필요는 없습니다. NestJS의 `PrismaService`는 계속 `DATABASE_URL`만 사용합니다.
테스트 DB는 별도 `prisma.test.config.ts`와 `TEST_DATABASE_URL`을 사용합니다.
빌드·서버 시작에는 `migrate deploy`를 추가하지 않습니다. 운영 마이그레이션은 승인 후 한 번의 별도 작업으로 실행합니다.

저장소의 마이그레이션은 `20261026015130_google_auth` 하나입니다.
`User`, `Session`, `OAuthAttempt` 테이블, Google sub 유니크 제약, 세션 외래키와 조회 인덱스를 생성합니다.
기존 테이블/데이터를 삭제하는 SQL은 없습니다. 단, 운영 DB가 이미 적용했는지는 별도로 확인해야 합니다.
Neon 연동만으로 이 테이블들이 생성되지는 않습니다.

아래 절차는 실행 안내이며 자동 실행되지 않습니다.

1. 배포할 소스 버전과 두 Vercel 프로젝트의 Production Branch(`main`)를 확정합니다.
   웹에는 `NEXT_PUBLIC_API_BASE_URL=/api`, `API_SERVER_ORIGIN=https://commit-health-api.vercel.app`을 설정합니다.
   서버에는 위 운영 변수와 Neon의 pooled/direct 연결을 설정하고, 두 연결이 같은 Neon 프로젝트·브랜치·DB를 가리키는지 확인합니다.
   Preview에서 운영 DB를 공유하지 않도록 연결 환경도 확인합니다.
2. Neon Console에서 테이블과 마이그레이션 이력을 먼저 조회합니다. 데이터가 있으면 복구 가능한 백업/브랜치도 준비합니다.
   아래 SQL은 읽기 전용이며 사용자 행이나 자격 증명을 조회하지 않습니다.

   ```sql
   SELECT tablename
   FROM pg_tables
   WHERE schemaname = 'public'
     AND tablename IN ('User', 'Session', 'OAuthAttempt', '_prisma_migrations');
   ```

   `_prisma_migrations` 테이블이 있을 때만 다음 SQL도 실행합니다.

   ```sql
   SELECT migration_name, finished_at, rolled_back_at
   FROM public._prisma_migrations
   ORDER BY started_at;
   ```

3. 신뢰할 수 있는 PC/작업 환경에서 `apps/server/.env.production`에 **운영 direct 연결**을
   `DATABASE_URL_UNPOOLED`로 직접 입력합니다. 이 파일은 자동 로드되지 않으므로 아래 명령에서 명시적으로 선택합니다.
   `.env`는 수정하지 않습니다. 새 터미널에서 기존 `DATABASE_URL`, `DATABASE_URL_UNPOOLED` 셸 변수가 없는지 확인합니다.
   Node의 `--env-file`보다 이미 설정된 셸 변수가 우선하므로 다른 DB의 값이 있으면 진행하지 않습니다.
   unpooled 값이 누락되면 로컬 `.env`로 대체될 수 있으므로, 빈 값 상태에서는 아래 명령을 실행하지 않습니다.
4. **모노레포 루트에서** 다음 상태 조회만 실행합니다. 운영 direct 연결을 선택했는지와 대기 중인 마이그레이션을 확인합니다.
   pending migration이 있으면 `migrate status`가 종료 코드 1을 반환할 수 있습니다. 연결/실패 이력 오류와 구분합니다.

   ```sh
   pnpm --filter @commit-health/server exec node --env-file=.env.production ./node_modules/prisma/build/index.js migrate status
   ```

   빈 DB라면 위 마이그레이션 하나가 필요합니다. 이미 완료된 이력이 있으면 다시 적용할 항목이 없습니다.
   테이블만 존재하고 이력이 없거나 실패/미완료 이력이 있으면 중단하고 원인을 확인합니다.
   `migrate reset`, `migrate dev`, `db push`, 임의의 `migrate resolve`는 운영에서 실행하지 않습니다.

5. 대상 DB와 pending 목록을 확인하고 **운영 적용 승인을 받은 뒤에만** 다음 명령을 실행합니다.

   ```sh
   pnpm --filter @commit-health/server exec node --env-file=.env.production ./node_modules/prisma/build/index.js migrate deploy
   ```

   같은 `migrate status` 명령을 다시 실행해 up to date인지 확인합니다.
   이 명령들은 DB 변경 승인 후 실행할 안내이며 빌드/테스트 과정에서는 실행하지 않습니다.

6. DB 준비 후 변경사항을 커밋·Push하고 기존 PR 흐름으로 `main`에 반영합니다.
   두 Vercel 프로젝트는 같은 main 변경으로 배포될 수 있으며 완료 순서는 보장되지 않습니다.
   백엔드 배포가 먼저 준비됐는지 확인하고, 필요하면 프론트 배포를 다시 실행합니다.
7. 백엔드 Production 주소의 `/api/health`가 JSON 200인지 확인합니다.
   Deployment Protection 로그인 화면으로 이동한다면 API 대상 도메인이 프록시에서 접근 가능하도록 설정을 조정합니다.
   웹의 `/api/health`도 JSON 200이고 비로그인 `/api/auth/me`가 401인지 확인합니다.
8. 실제 Google 로그인으로 신규 사용자 생성, 재로그인, 새로고침 복원, 로그아웃과 잘못된 콜백 처리를 확인합니다.
   쿠키가 웹 도메인에 `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`로 설정되는지도 확인합니다.
   코드·토큰이 포함된 콜백 URL이나 시크릿을 로그/스크린샷/문서에 남기지 않습니다.

## Push 없이 배포할 때

Vercel 계정에서 프로젝트를 준비하고 위 Root Directory를 설정한 다음, 모노레포 루트에서
Vercel CLI로 해당 프로젝트에 연결해 로컬 소스를 Preview 배포할 수 있습니다.
GitHub 연동 배포는 push된 소스를 사용하므로, 아직 push하지 않은 이번 화면은 포함되지 않습니다.
실제 배포 명령 실행 전 프로젝트 대상과 Preview/Production 환경변수 설정을 확인합니다.

`.vercelignore`는 CLI 업로드에서 로컬 환경파일·키·빌드 산출물을 제외합니다.
`.env`와 웹 `.env.local`의 로컬 개발 값은 유지하며 운영 환경변수는 Vercel 설정에서 별도로 관리합니다.
CLI 인증이 만든 루트 `.env.local`과 `.vercel/`도 Git과 업로드에서 제외합니다.

## 배포 후 확인

1. PC와 모바일에서 로고와 Google 로그인 버튼이 표시되는지 확인합니다.
2. 웹의 `/api/health`가 JSON 200, 비로그인 `/api/auth/me`가 401인지 확인합니다.
3. Google 로그인 시작 → 웹의 callback → 홈 복귀와 로그인 상태 복원을 확인합니다.
4. 새로고침 후 로그인 유지, 로그아웃, 인증 오류 화면을 확인합니다.

## 출처

- [Figma 로고 원본](https://www.figma.com/design/K3xzv6s9qHPFFx72KJPkP8/commit-health?node-id=69-10)
- [Google 로그인 브랜딩과 공식 아이콘](https://developers.google.com/identity/branding-guidelines)
- [Vercel 모노레포 설정](https://vercel.com/docs/monorepos)
- [Vercel NestJS 지원](https://vercel.com/docs/frameworks/backend/nestjs)
- [Vercel 관리형 DB 연결](https://vercel.com/docs/marketplace-storage)
- [Neon과 Prisma 7의 pooled/direct 연결](https://neon.com/docs/guides/prisma)
- [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites)
- [Vercel 패키지 매니저 감지](https://vercel.com/docs/package-managers)
- [Vercel Corepack 설정](https://vercel.com/docs/builds/configure-a-build#corepack)
- [pnpm 10 워크스페이스 루트 옵션](https://pnpm.io/10.x/pnpm-cli#-w---workspace-root)
- [Vercel Node.js 지원 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Next.js 환경변수](https://nextjs.org/docs/app/guides/environment-variables)
- [Google 서버 Authorization Code Flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google JavaScript 원본과 리디렉션 URI 형식](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
