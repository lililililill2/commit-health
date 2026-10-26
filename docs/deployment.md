# Vercel 프론트엔드 배포

로그인 첫 화면은 Figma의 `logo!!!!!!!!` 레이어 원본과 Google 공식 아이콘을 로컬 자산으로 사용합니다.
Figma 파일 전체 랜딩 페이지를 구현한 것은 아니며, 화면은 로고와 로그인 버튼 중심으로 구성합니다.

## 프로젝트 설정

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

## 환경변수와 인증 연결

- Vercel의 `NEXT_PUBLIC_API_BASE_URL`에 외부에서 접근 가능한 HTTPS 백엔드 API 주소를 지정합니다. `/api`까지 포함합니다.
- 이 값은 브라우저에 공개되고 빌드 때 반영됩니다. 변경 후에는 다시 배포합니다.
- Google 시크릿과 `DATABASE_URL`은 프론트엔드에 등록하지 않습니다. NestJS를 배포할 서비스에만 등록합니다.
- 실제 Google 로그인에는 별도로 배포한 NestJS와 PostgreSQL이 필요합니다. 프론트만 배포한 것으로 인증 배포가 완료되지는 않습니다.
- 배포 주소의 `localhost`는 방문자의 컴퓨터를 가리키므로 로컬 API 주소를 배포용으로 사용하지 않습니다.
- 백엔드 `FRONTEND_URL`, `CORS_ORIGIN`은 배포한 웹 origin으로, `GOOGLE_CALLBACK_URL`은 배포한 백엔드의 `/api/auth/google/callback` 주소로 설정합니다.
- Google Cloud에도 동일한 콜백 주소를 등록합니다. 운영 OAuth 클라이언트는 개발용과 분리합니다.
- 백엔드는 `NODE_ENV=production`과 HTTPS로 실행합니다. 서로 다른 사이트에 웹과 API를 배포하면 현재 설정의 `COOKIE_SAME_SITE=none`이 필요하며 브라우저의 서드파티 쿠키 제한도 확인해야 합니다. 실제 서비스에는 같은 사이트의 웹/API 도메인 구성을 권장합니다.

## Push 없이 배포할 때

Vercel 계정에서 프로젝트를 준비하고 위 Root Directory를 설정한 다음, 모노레포 루트에서
Vercel CLI로 해당 프로젝트에 연결해 로컬 소스를 Preview 배포할 수 있습니다.
GitHub 연동 배포는 push된 소스를 사용하므로, 아직 push하지 않은 이번 화면은 포함되지 않습니다.
실제 배포 명령 실행 전 프로젝트 대상과 Preview/Production 환경변수 설정을 확인합니다.

`.vercelignore`는 CLI 업로드에서 로컬 환경파일·키·빌드 산출물을 제외합니다.
`.env`는 기존 로컬 개발 값을 유지하며 배포 환경변수는 Vercel 설정에서 별도로 관리합니다.

## 배포 후 확인

1. PC와 모바일에서 로고와 Google 로그인 버튼이 표시되는지 확인합니다.
2. Google 로그인 시작 → 콜백 → 홈 복귀와 로그인 상태 복원을 확인합니다.
3. 새로고침 후 로그인 유지, 로그아웃, 인증 오류 화면을 확인합니다.

## 출처

- [Figma 로고 원본](https://www.figma.com/design/K3xzv6s9qHPFFx72KJPkP8/commit-health?node-id=69-10)
- [Google 로그인 브랜딩과 공식 아이콘](https://developers.google.com/identity/branding-guidelines)
- [Vercel 모노레포 설정](https://vercel.com/docs/monorepos)
- [Vercel 패키지 매니저 감지](https://vercel.com/docs/package-managers)
- [Vercel Corepack 설정](https://vercel.com/docs/builds/configure-a-build#corepack)
- [pnpm 10 워크스페이스 루트 옵션](https://pnpm.io/10.x/pnpm-cli#-w---workspace-root)
- [Vercel Node.js 지원 버전](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Next.js 환경변수](https://nextjs.org/docs/app/guides/environment-variables)
