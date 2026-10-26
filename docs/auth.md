# Google 로그인

## API와 흐름

| API                             | 접근          | 결과                                                               |
| ------------------------------- | ------------- | ------------------------------------------------------------------ |
| `GET /api/auth/google`          | 공개          | OAuth 요청을 DB에 저장하고 Google로 303 이동                       |
| `GET /api/auth/google/callback` | 공개          | state·PKCE·nonce·ID 토큰 검증 후 사용자 upsert, DB 세션 발급       |
| `GET /api/auth/me`              | 로그인        | `{ user: { id, createdAt, updatedAt }, csrfToken }`, 미인증 시 401 |
| `POST /api/auth/logout`         | 로그인 + CSRF | DB 세션 삭제와 쿠키 제거, 204                                      |

로그인 성공 시 프론트엔드 `/`, 실패 시 `/auth/error`로 이동합니다. 외부 return URL을 입력받지 않습니다.
`/account`는 로그인 확인이 끝나기 전까지 내용을 표시하지 않고 미인증이면 홈으로 이동합니다.
이 페이지 제어는 UI용이며, 실제 데이터 접근은 백엔드의 기본 인증 guard가 검증합니다.

사용자는 Google의 `sub`로 식별합니다. User의 이메일·이름·사진은 저장하지 않습니다.
Google access/refresh/ID 토큰은 영구 저장하거나 프론트엔드에 전달하지 않습니다.
opaque 세션 쿠키의 SHA-256 해시만 DB에 저장하며 CSRF 토큰은 `/me`에서 받아 브라우저 메모리에만 둡니다.
세션은 7일의 고정 만료를 가지며 서버 재시작 후에도 유지됩니다. 로그인할 때 현재 브라우저의 이전 세션을 폐기하고 새 쿠키를 발급합니다.
OAuth 요청은 10분 만료, 브라우저 쿠키에 바인딩되며 한 번만 사용할 수 있습니다.
만료된 세션·OAuth 요청은 새 로그인 요청 때 정리하며, 만료된 세션은 인증 요청에서도 거부·정리합니다.

## 개발 환경 설정

`apps/server/.env`에 다음 값을 설정합니다. 실제 비밀정보는 Git과 채팅에 넣지 않습니다.

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:8080/api/auth/google/callback
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
COOKIE_SAME_SITE=lax
```

Google Cloud의 웹 애플리케이션 OAuth 클라이언트에 위 callback을 정확하게 등록합니다.
프론트엔드 `.env.local`은 `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api`를 사용합니다.
`localhost`와 `127.0.0.1`을 섞지 마세요. 쿠키와 Origin이 일치하지 않습니다.
DB migration을 적용하고 두 개발 서버를 재시작한 뒤 홈의 Google 로그인 버튼으로 시작합니다.
Google 설정이 없으면 Health API는 실행되며 로그인만 실패 페이지로 이동합니다.

## 쿠키와 CSRF

개발 HTTP는 HttpOnly·host-only·SameSite=Lax 쿠키를 사용합니다.
운영은 `NODE_ENV=production`, HTTPS callback·프론트엔드·CORS origin이 필수이며 Secure와 `__Host-` 쿠키 이름을 사용합니다.
같은 사이트의 프론트엔드·API는 `COOKIE_SAME_SITE=lax`, 다른 사이트의 HTTPS 구성만 `none`을 사용합니다.
브라우저의 서드파티 쿠키 정책 때문에 다른 사이트 구성이 차단될 수 있으므로 가능하면 같은 사이트의 HTTPS 구성을 사용하세요.
OAuth 요청 쿠키는 Google의 최상위 GET callback을 받을 수 있도록 항상 SameSite=Lax입니다.
쿠키의 Domain을 확장하지 않습니다. CORS는 명시된 origin과 credentials만 허용하고 Axios는 `withCredentials`를 사용합니다.

인증된 변경 요청은 정확한 `Origin: FRONTEND_URL`과 세션에 연결된 `X-CSRF-Token`을 모두 요구합니다.
토큰 없는 변경 요청과 로그아웃은 403으로 거부됩니다. OAuth callback은 전용 state·PKCE·nonce 검증으로 보호합니다.
세션은 HttpOnly 쿠키, CSRF는 메모리 Query 캐시에만 두며 localStorage·sessionStorage에 저장하지 않습니다.
로그아웃하면 Query 캐시도 비워 다른 사용자 정보가 남지 않게 합니다.

GET callback의 authorization code는 Google Authorization Code Flow가 전달하는 일회성 쿼리 값입니다.
이 프로토콜상의 전달을 제외하고 code를 다른 URL·응답·로그에 복사하지 않습니다.
callback 응답은 즉시 깨끗한 프론트엔드 URL로 이동하고 `no-store`, `Referrer-Policy: no-referrer`를 설정합니다.
운영 reverse proxy·분석 도구에서도 `/api/auth` 요청의 쿼리, Cookie, Set-Cookie, Authorization, CSRF 헤더와 본문 토큰을 기록하지 않도록 설정해야 합니다.

## 이후 사용자 데이터 구현 규칙

백엔드 API는 기본적으로 인증이 필요합니다. 공개할 경로에만 `@Public()`을 명시합니다.
`@CurrentUser()`의 `id`를 사용자 식별자로 사용하세요. 요청 body·query의 `userId`는 소유권 증거가 아닙니다.
건강 기록·캐릭터 조회/수정은 항상 `where: { id: resourceId, userId: currentUser.id }`처럼 소유자를 함께 제한합니다.
현재는 이 기반만 제공하며 건강 기록·캐릭터 모델이나 API는 추가하지 않았습니다.

## 수동 검증

1. 처음 쓰는 Google 계정으로 로그인하고 홈의 로그인 표시와 `/account` 접근을 확인합니다.
2. 새로고침과 서버 재시작 후 로그인 상태가 복원되는지 확인합니다.
3. 같은 Google 계정으로 다시 로그인해 User가 중복 생성되지 않는지 확인합니다.
4. 로그아웃 후 `/api/auth/me`가 401이고 `/account`가 홈으로 이동하는지 확인합니다.
5. Google 동의 취소 시 실패 안내가 나오고 다시 로그인할 수 있는지 확인합니다.

자동 검증은 `pnpm test`, `pnpm test:e2e`, `pnpm test:db`입니다.
DB 테스트는 실제 DB와 로컬 서명 OIDC provider를 사용하며 Google의 실제 동의 화면 검증과 구분합니다.
`test:db`는 `.env.test` 또는 환경변수의 `TEST_DATABASE_URL`만 사용하며 `commit_health_test` 이외의 DB는 거부합니다.
개발 `.env`의 `DATABASE_URL`은 테스트 연결의 fallback으로 사용하지 않습니다. 테스트 시작 전에 전용 migration을 적용합니다.
