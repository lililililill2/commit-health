# Commit Health — 프로젝트 구조

건강한 생활 습관을 기록(커밋)하고 캐릭터를 성장시키는 개인 건강 관리 서비스입니다.
현재는 **Google 로그인**과 **기숙사 3D 메인 대시보드**까지 구현되어 있고, 커밋·기록·업적·설정 화면은 자리만 잡힌 상태입니다.

## 기술 스택

| 영역      | 사용 기술                                                                        |
| --------- | -------------------------------------------------------------------------------- |
| 모노레포  | pnpm 10 workspace + Turborepo 2, Node.js 24                                      |
| 웹        | Next.js 16 (App Router), React 19, Tailwind CSS 4, TanStack Query 5, Axios       |
| 3D        | three.js, @react-three/fiber, @react-three/drei (`public/models/dorm.glb`)       |
| 서버      | NestJS 12 (Express, ESM), class-validator, openid-client (Google OIDC)           |
| DB        | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`), 운영은 Neon                        |
| 테스트    | 서버: Jest (unit / e2e / DB 통합), 웹: `node --test`                             |
| 품질·배포 | ESLint 9, Prettier, GitHub Actions CI(+Discord 알림), CodeRabbit, Vercel(웹·API) |

## 디렉터리 구조

```text
commit-health/
├─ apps/
│  ├─ web/                 # @commit-health/web — Next.js 프론트엔드 (FSD 구조)
│  └─ server/              # @commit-health/server — NestJS API 서버
├─ docs/
│  ├─ auth.md              # Google 로그인·세션·CSRF 설계와 규칙
│  ├─ deployment.md        # Vercel·Neon 운영 배포 절차
│  ├─ data-model.md        # 건강 기록·퀘스트·상점 등 데이터 모델 초안
│  ├─ aws-migration.md     # (보류) AWS 통합 시나리오
│  └─ on-prem-migration.md # (보류) 온프레미스 단일 서버 시나리오
├─ .github/workflows/ci.yml
├─ package.json            # 루트 스크립트 (turbo 실행)
├─ pnpm-workspace.yaml     # apps/* 워크스페이스
└─ turbo.json              # 태스크 파이프라인·캐시·환경변수 설정
```

### apps/web — Next.js (Feature-Sliced Design)

라우트는 루트 `app/`에만 두고, 실제 구현은 `src/`의 FSD 레이어에 둡니다.
루트 `pages/`는 `src/pages/`가 Pages Router로 해석되는 것을 막기 위한 빈 디렉터리이므로 지우거나 라우트를 추가하지 않습니다.
경로 별칭은 `@/*` → `src/*`입니다.

```text
apps/web/
├─ app/                          # 라우트 (얇은 re-export만)
│  ├─ layout.tsx                 # 루트 레이아웃, AppProviders 적용
│  ├─ page.tsx                   # / → pages/home
│  ├─ (member)/                  # 로그인 필요 그룹 (layout에서 RequireSession)
│  │  ├─ commit/  records/  achievements/  settings/   # 현재 placeholder
│  ├─ 3d-preview/                # 기숙사 3D 미리보기
│  └─ auth/error/                # 로그인 실패 안내
├─ pages/README.md               # 라우터 충돌 방지용 (수정 금지)
├─ public/                       # brand 로고, 배경 SVG, models/dorm.glb
└─ src/
   ├─ app/        providers(QueryProvider), styles/globals.css
   ├─ pages/      home, auth-error, menu-placeholder, three-d-preview
   ├─ widgets/    dorm-stage — 3D 장면 + HUD(메인 메뉴, 일일 퀘스트), 실시간 시계
   ├─ features/   auth — Google 로그인 버튼, 로그아웃, RequireSession
   │              dorm-viewer — R3F 캔버스, 하늘·구름·캠퍼스 배경, 카메라 설정
   ├─ entities/   session — useSession() (GET /auth/me, 401이면 null)
   └─ shared/     api — Axios 인스턴스(withCredentials), health API
```

화면 흐름

- `/` 비로그인: 로고 + Google 로그인 버튼
- `/` 로그인: `DormStage` — 회전 가능한 기숙사 3D 모델, 좌측 메뉴(커밋하기·기록·업적·설정), 우측 일일 퀘스트(현재 정적 데이터)
- 메뉴 페이지는 `MenuPlaceholderPage`로 제목과 "메인으로" 링크만 표시

### apps/server — NestJS

```text
apps/server/
├─ prisma/
│  ├─ schema.prisma              # User, Session, OAuthAttempt
│  └─ migrations/20261026015130_google_auth/
├─ prisma.config.ts              # CLI용 (DATABASE_URL_UNPOOLED 우선)
├─ prisma.test.config.ts         # 테스트 DB 전용 (TEST_DATABASE_URL)
├─ src/
│  ├─ main.ts                    # 부트스트랩, PORT로 listen
│  ├─ app.module.ts              # ConfigModule(env 검증) + Health + Auth
│  ├─ config/                    # configure-app(전역 prefix /api, CORS, ValidationPipe), environment 검증
│  ├─ auth/auth-context.ts       # @Public(), @CurrentUser(), 세션 타입
│  ├─ prisma/                    # PrismaModule / PrismaService
│  ├─ modules/
│  │  ├─ health/                 # GET /api/health (공개)
│  │  └─ auth/                   # 컨트롤러, 서비스, 쿠키, Google OIDC, 전역 SessionGuard
│  └─ generated/prisma/          # prisma generate 산출물 (Git 제외)
└─ test/                         # e2e(health), DB 통합(auth), 로컬 OIDC provider 헬퍼
```

## API

모든 경로는 `/api` 접두사를 가지며, `SessionGuard`가 전역 guard로 등록되어 **기본적으로 인증이 필요**합니다.

| 메서드 | 경로                        | 접근          | 설명                                            |
| ------ | --------------------------- | ------------- | ----------------------------------------------- |
| GET    | `/api/health`               | 공개          | `{ status: 'ok', service }`                     |
| GET    | `/api/auth/google`          | 공개          | OAuth 시도 저장 후 Google로 303 이동            |
| GET    | `/api/auth/google/callback` | 공개          | state·PKCE·nonce 검증, 사용자 upsert, 세션 발급 |
| GET    | `/api/auth/me`              | 로그인        | `{ user, csrfToken }`, 미인증 시 401            |
| POST   | `/api/auth/logout`          | 로그인 + CSRF | 세션 삭제, 204                                  |

## 데이터 모델

| 모델           | 주요 필드                                                  | 비고                                |
| -------------- | ---------------------------------------------------------- | ----------------------------------- |
| `User`         | `id`(uuid), `googleSub`(unique)                            | 이메일·이름·사진은 저장하지 않음    |
| `Session`      | `tokenHash`(SHA-256), `userId`, `csrfToken`, `expiresAt`   | 7일 고정 만료, User 삭제 시 cascade |
| `OAuthAttempt` | `tokenHash`, `state`, `nonce`, `codeVerifier`, `expiresAt` | 10분 만료, 1회용                    |

건강 기록·캐릭터 모델은 아직 없습니다.

## 인증·보안 규칙 요약

자세한 내용은 [docs/auth.md](docs/auth.md)를 참고하세요.

- 세션은 HttpOnly opaque 쿠키, DB에는 해시만 저장. 운영에서는 `Secure` + `__Host-` 접두사.
- GET/HEAD/OPTIONS 외 요청은 `Origin === FRONTEND_URL`과 `X-CSRF-Token`이 모두 필요.
- CSRF 토큰은 Query 캐시(메모리)에만 보관하며 localStorage 등에 저장하지 않음.
- 공개 API에만 `@Public()`을 붙이고, 사용자 데이터는 항상 `@CurrentUser().id`로 소유자를 제한해서 조회.
- 콜백 URL·authorization code·토큰은 로그에 남기지 않음.

## 개발 환경

```sh
pnpm install
cp apps/server/.env.example apps/server/.env     # DATABASE_URL, GOOGLE_* 설정
cp apps/web/.env.example apps/web/.env.local
pnpm prisma:migrate                               # 개발 DB에 migration 적용
pnpm dev                                          # web :3000, server :8080
```

`localhost`와 `127.0.0.1`을 섞어 쓰면 쿠키·Origin이 맞지 않으므로 하나로 통일합니다.

### 주요 루트 스크립트

| 명령                                  | 설명                                                          |
| ------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev` / `dev:web` / `dev:server` | 개발 서버 실행                                                |
| `pnpm lint` / `typecheck` / `build`   | 전체 워크스페이스 대상                                        |
| `pnpm test`                           | 서버 Jest unit + 웹 dorm-viewer 설정 테스트                   |
| `pnpm test:e2e`                       | 서버 HTTP 통합 테스트                                         |
| `pnpm test:db`                        | 테스트 DB(`commit_health_test`)에 migration 후 DB 통합 테스트 |
| `pnpm format` / `format:check`        | Prettier                                                      |
| `pnpm prisma:*`                       | generate, validate, migrate, deploy, studio                   |

## CI / 배포

- **CI** (`.github/workflows/ci.yml`): `main` push·PR마다
  - `quality`: format → lint → typecheck → test → test:e2e → prisma validate → build
  - `database`: Postgres 17 서비스 컨테이너로 `test:db`
  - `notify`: 결과를 Discord로 전송
- **배포**: Vercel 프로젝트 2개 (웹 `apps/web`, API `commit-health-api` = `apps/server`).
  웹이 `/api/*`를 `API_SERVER_ORIGIN`으로 rewrite하여 같은 사이트에서 쿠키를 유지합니다.
  운영 DB migration은 빌드에 포함하지 않고 승인 후 수동으로 실행합니다. 절차는 [docs/deployment.md](docs/deployment.md) 참고.

## 커뮤니티 기능 설계 (예정)

### 범위

| 기능                 | 설명                                                                          |
| -------------------- | ----------------------------------------------------------------------------- |
| 건강 기록 스냅샷     | 일정 기간의 내 기록을 요약해 **변하지 않는 사본**으로 보관하고, 원하면 공유   |
| 스냅샷으로 목표 설정 | 다른 사람의 스냅샷을 받아 그 수치·루틴을 내 목표로 가져옴                     |
| 친구                 | 친구 요청·수락·차단, 친구 코드로 찾기                                         |
| 커밋 경쟁            | 친구들과 기간·종목(커밋 수, 물, 수면 등)을 정해 순위 경쟁                     |
| 채팅방               | 1:1 / 그룹 채팅, 스냅샷 공유 메시지, "OO님이 물 4컵 커밋!" 같은 시스템 메시지 |

### 핵심 결정: 지금 배포 환경에서는 WebSocket을 쓸 수 없음

현재 API는 Vercel 서버리스 함수로 실행되므로 연결을 계속 유지하는 WebSocket 서버를 띄울 수 없습니다.
서버 이전은 보류 중이고, 실시간 전용 외부 서비스(Pusher, Ably 등)를 추가하면 관리할 플랫폼이 또 늘어납니다.
그래서 **실시간 기능을 두 단계로 나눕니다.**

| 단계                 | 방식                                                                                                        | 비고                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| 1단계 (지금)         | **HTTP 폴링**: 채팅방이 열려 있고 탭이 보일 때만 2~3초 간격으로 `GET /chat/rooms/:id/messages?after=<커서>` | TanStack Query `refetchInterval`로 구현       |
| 2단계 (서버 이전 후) | **WebSocket**: `@nestjs/websockets` + Socket.IO, 연결 시 세션 쿠키와 `Origin`으로 인증                      | 메시지 저장·조회 API는 1단계 것을 그대로 사용 |

웹에서는 채팅 수신 방식을 `entities/chat`의 훅 하나로 감싸 두고, 2단계에서 그 내부만 폴링 → 소켓으로 바꿉니다.
학교 규모(수백 명)에서는 폴링으로도 충분하고, 메시지는 증가하는 `BigInt` id를 커서로 써서 새 메시지만 가져옵니다.

### 기술 스택

| 영역               | 선택                                                                      | 이유                                                                           |
| ------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 저장소             | 기존 PostgreSQL + Prisma                                                  | 친구·경쟁·채팅 모두 관계형 데이터. 새 DB를 추가하지 않음                       |
| 스냅샷 본문        | `Jsonb` + `schemaVersion`                                                 | 기록 항목이 늘어도 과거 스냅샷을 그대로 보존하고, 버전별로 읽을 수 있음        |
| JSON 검증          | **zod** 추가 (서버의 `Json` 컬럼 입출력 검증)                             | 중첩 JSON은 class-validator보다 간결. 요청 DTO는 기존 class-validator 유지     |
| 순위 계산          | `Commit` 집계 SQL (`status = VALID`, 기간 조건) + 인덱스                  | 신고로 무효가 된 기록이 자동으로 빠짐. 느려지면 순위 스냅샷 테이블로 미리 계산 |
| 채팅 수신          | 1단계 폴링 → 2단계 Socket.IO (위 표)                                      | 현재 배포 환경 제약                                                            |
| 목록 조회          | 커서 기반 페이지네이션 + TanStack Query `useInfiniteQuery`                | 채팅·피드에서 페이지가 밀리지 않음                                             |
| 도배 방지          | DB 기준 검사 (최근 N초 내 메시지 수)                                      | 서버리스는 인스턴스마다 메모리가 달라 메모리 기반 rate limit이 동작하지 않음   |
| 알림               | `Notification` 테이블 + 헤더 배지 폴링                                    | 친구 요청·경쟁 결과·멘션. 웹 푸시는 서버 이전 후 검토                          |
| 공유 링크 미리보기 | Next.js `opengraph-image` (`ImageResponse`)                               | 공유 범위가 "링크"인 스냅샷만, 민감 수치는 제외한 카드 이미지                  |
| 신고               | 데이터 모델 초안의 `Report`를 확장해 대상 종류(기록·메시지·스냅샷)를 구분 | 채팅·스냅샷도 같은 관리자 화면에서 처리                                        |

새로 추가할 패키지는 지금은 **zod 하나**이고, Socket.IO 관련 패키지(`@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io-client`)는 2단계에서 추가합니다.

### 데이터 모델 개요

자세한 필드는 구현할 때 [docs/data-model.md](docs/data-model.md)에 추가합니다.

| 모델                           | 역할                                                                                                                                          |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `HealthSnapshot`               | 소유자, 제목, 기간, `schemaVersion`, `data`(요약 통계·루틴), 공개 범위(`PRIVATE`/`FRIENDS`/`LINK`), 공유 토큰, 가져간 횟수. 생성 후 수정 불가 |
| `Goal`                         | 사용자의 목표. `sourceSnapshotId`로 어떤 스냅샷에서 가져왔는지 기록. 일일 퀘스트 생성의 기준이 됨                                             |
| `Friendship`                   | 요청자·대상, 상태(`PENDING`/`ACCEPTED`/`BLOCKED`). 두 사용자 쌍은 하나만 존재하도록 유니크 제약                                               |
| `Challenge`, `ChallengeMember` | 경쟁 제목, 종목, 시작·종료일, 참가자. 순위는 저장하지 않고 조회할 때 계산                                                                     |
| `ChatRoom`, `ChatMember`       | 방 종류(`DIRECT`/`GROUP`/`CHALLENGE`), 멤버별 마지막 읽은 메시지 id(안 읽은 수 계산)                                                          |
| `ChatMessage`                  | `BigInt` 자동 증가 id(커서), 종류(`TEXT`/`SNAPSHOT`/`SYSTEM`), 본문, 참조 id, 삭제 시각                                                       |
| `Notification`                 | 받는 사람, 종류, 참조 id, 읽은 시각                                                                                                           |

### 코드 배치

```text
apps/server/src/modules/
├─ friends/        친구 요청·수락·차단, 친구 코드 검색
├─ snapshots/      스냅샷 생성(기록 집계 → 사본 저장), 공개 범위, 공유 링크
├─ goals/          스냅샷 가져오기 → Goal 생성
├─ challenges/     경쟁 생성·참가, 순위 집계
├─ chat/           방·메시지 API (2단계에서 Gateway 추가)
└─ notifications/

apps/web/
├─ app/(member)/community/  friends/  chat/[roomId]/  snapshots/[id]/  challenges/[id]/
├─ app/s/[token]/           링크로 공유된 스냅샷 (비로그인 열람 가능, 가져오기는 로그인 필요)
└─ src/
   ├─ entities/   friend, snapshot, goal, challenge, chat (조회 훅, 타입)
   ├─ features/   send-friend-request, create-snapshot, adopt-snapshot, join-challenge, send-message
   ├─ widgets/    chat-room, leaderboard, snapshot-card
   └─ pages/      community, chat-room, snapshot-detail, challenge-detail
```

### 지켜야 할 규칙

- **스냅샷은 공유하기 전에 무엇이 담기는지 보여 줍니다.** 기본 공개 범위는 `PRIVATE`이고, 키·몸무게·건강 상태 메모처럼 민감한 항목은 사용자가 직접 켰을 때만 넣습니다.
- 스냅샷에는 원본 기록이 아닌 **요약 통계와 루틴**만 담습니다. 가져간 사람에게는 수치·목표만 복사되고 원래 소유자의 다른 정보는 넘어가지 않습니다.
- 권한 확인은 서버에서 합니다.
  - 친구 공개 스냅샷: 조회할 때마다 `ACCEPTED` 친구 관계인지 확인
  - 채팅 메시지: 해당 방의 `ChatMember`인지 확인
  - 차단한 사용자: 친구 요청, 채팅, 경쟁 초대를 모두 막음
- 사용자를 찾을 때는 닉네임 검색 대신 **친구 코드**를 써서, 전체 사용자 목록이 노출되지 않게 합니다.
- 모든 쓰기 요청은 기존처럼 세션 + CSRF 검사를 거칩니다. 2단계 WebSocket 연결도 세션 쿠키와 `Origin`을 확인합니다.
- 사용자 대부분이 미성년자이므로 신고·차단 기능을 채팅과 함께 출시하고, 메시지 보관 기간을 정합니다.

### 결정이 필요한 사항

1. **닉네임**: 친구·채팅·순위에는 화면에 보일 이름이 필요합니다. 현재는 이름을 저장하지 않으므로 닉네임 입력을 온보딩에 추가해야 합니다.
2. **채팅 범위**: 1단계에서 1:1만 할지, 그룹·경쟁방 채팅까지 할지
3. **스냅샷 공개 범위**: 친구 공개까지만 할지, 링크 공유(비로그인 열람)까지 허용할지
4. **메시지 보관 기간**과 신고 처리 담당자

## 현재 상태와 다음 작업

완료

- Google OIDC 로그인, DB 세션, CSRF 보호, 로그아웃
- 로그인 화면, 기숙사 3D 메인 대시보드(메뉴·일일 퀘스트 UI)
- CI, Vercel 배포 구성

미구현

- 커밋하기 / 기록 / 업적 / 설정 페이지 실제 기능
- 건강 기록·캐릭터·퀘스트 데이터 모델과 API (현재 일일 퀘스트는 하드코딩)
- 커뮤니티 기능 (스냅샷, 목표 가져오기, 친구, 커밋 경쟁, 채팅)

보류

- 서버 이전 ([AWS](docs/aws-migration.md), [온프레미스](docs/on-prem-migration.md)). 채팅의 WebSocket 전환은 서버 이전 후 진행
