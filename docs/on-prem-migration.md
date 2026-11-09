# 온프레미스 단일 서버 이전 시나리오 (초안)

비용 문제로 AWS 이전([aws-migration.md](aws-migration.md))은 보류하고, **서버 한 대**에 웹·API·DB·파일을 모두 올리는 방향을 정리합니다.

## 한 대로 할 때 먼저 풀어야 하는 문제

| 문제                        | 이유                                                                      | 해결 방향                                           |
| --------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------- |
| 외부에서 접속 가능한가      | 학교·가정망은 공인 IP가 없거나 들어오는 포트(443)가 막혀 있는 경우가 많음 | Cloudflare Tunnel (아래 참고)                       |
| HTTPS와 도메인              | Google OAuth 리디렉션 URI는 공개 도메인 + HTTPS여야 함 (IP 주소 불가)     | 도메인 1개 구매(연 1~2만 원) 후 Cloudflare DNS 사용 |
| 서버가 죽으면 전부 멈춤     | 단일 장애점                                                               | 자동 재시작, UPS, 외부 모니터링                     |
| 디스크가 죽으면 데이터 유실 | 관리형 DB의 자동 백업이 없어짐                                            | 매일 DB 백업 + **서버 밖** 저장, 복구 리허설        |
| 배포                        | GitHub Actions가 내부망 서버에 접속할 수 없음                             | 서버에서 바깥으로 연결하는 self-hosted runner       |

## 목표 구성

```text
 사용자 ─HTTPS─▶ Cloudflare (DNS, TLS, 실제 서버 IP 숨김)
                     │  (서버가 바깥으로 연결한 터널, 열어 둔 인바운드 포트 없음)
 ┌───────────────────▼──────────────────── 온프레미스 서버 (Docker Compose)
 │ cloudflared
 │   └─▶ caddy :80  ── /api/* → server:8080  (NestJS + @nestjs/schedule)
 │                  └─ /*     → web:3000     (Next.js standalone)
 │ postgres:17     (외부 노출 없음, 볼륨: /srv/commit-health/pgdata)
 │ uploads 볼륨    (급식 사진: /srv/commit-health/uploads, API를 통해서만 제공)
 │ backup          (매일 pg_dump + 사진 → 외부 저장소로 암호화 업로드)
 │ github runner   (main 배포 전용)
 └────────────────────────────────────────────────────────────────────
 외부: GitHub(GHCR 이미지 저장) · 외부 업타임 모니터 → Discord 알림 · 백업 저장소
```

### 구성 요소별 선택

- **외부 공개 — Cloudflare Tunnel**: 서버의 `cloudflared`가 Cloudflare로 바깥 방향 연결을 만들기 때문에, 공유기·학교 방화벽에서 포트를 열 필요가 없습니다. TLS 인증서도 Cloudflare가 처리하고 무료입니다. 단, 도메인의 DNS를 Cloudflare에 맡겨야 합니다.
  - 공인 IP와 443 포트 개방이 가능하다면 Caddy가 직접 인증서를 받는 방식도 됩니다. 이 경우 서버 IP가 노출되므로 방화벽 관리가 더 중요해집니다.
- **같은 도메인에서 웹·API 제공**: AWS 안과 같습니다. Caddy가 경로로 나누므로 Next.js rewrite, `API_SERVER_ORIGIN`, pooled/unpooled 구분이 필요 없고 쿠키 설정은 그대로입니다.
  - Cloudflare가 앞에 있으므로 `/api/auth/*`는 캐시하지 않도록 Cache Rule을 둡니다. 서버가 이미 `Cache-Control: no-store`를 보내므로 기본 동작으로도 캐시되지 않습니다.
- **DB — 같은 서버의 PostgreSQL 컨테이너**: 포트를 호스트 밖으로 열지 않고 Compose 내부 네트워크에서만 접근합니다.
- **급식 사진 — 로컬 디스크**: S3 호환 저장소를 따로 띄우기보다, 서버 코드에 `StorageService` 인터페이스를 두고 로컬 디스크 구현으로 시작합니다. 사진은 공개 URL 없이 소유자 확인을 거친 API로만 내려줍니다. 나중에 외부 저장소로 바꿀 때는 구현만 교체합니다.
- **정기 작업**: 서버가 상시 실행되므로 `@nestjs/schedule`로 급식 수집, 일일 HP 판정, 퀘스트 배정을 처리합니다.
- **AI**: 외부 AI API를 호출하고, 키는 서버의 `.env` 파일에만 둡니다.

## 운영 안전장치 (한 대라서 꼭 필요한 것)

### 백업 — 가장 중요

- 매일 새벽 `pg_dump -Fc` + 사진 디렉터리를 암호화해 **서버 밖**에 저장합니다. 같은 디스크의 백업은 백업이 아닙니다.
  - 무료 후보: Cloudflare R2(10GB 무료), Backblaze B2, 팀 Google Drive(rclone 사용)
- 보관 정책 예시: 일간 7개, 주간 4개, 월간 3개
- **한 달에 한 번 복구 리허설**: 백업을 빈 Postgres에 복원하고 `prisma migrate status`로 확인합니다. 복원해 보지 않은 백업은 믿지 않습니다.
- 스키마 migration을 적용하기 전에는 항상 수동 백업을 하나 더 만듭니다.

### 장애 대비

- 모든 컨테이너 `restart: unless-stopped`, Docker 서비스 부팅 시 자동 시작
- BIOS에서 "정전 후 전원 복구 시 자동 켜짐" 설정, 가능하면 UPS
- 외부 업타임 모니터(UptimeRobot, Better Stack 무료 등)가 `/api/health`를 확인하고 Discord로 알림. 모니터를 같은 서버에 두면 서버가 죽었을 때 알림도 함께 죽습니다.
- 디스크 사용량 80% 초과 시 알림 (사진이 쌓이면 디스크가 먼저 찹니다)

### 보안

- SSH는 키 인증만 허용하고 비밀번호·root 로그인은 끕니다. 가능하면 SSH도 Tailscale 같은 VPN 안에서만 엽니다.
- 방화벽(ufw)으로 인바운드는 SSH(또는 VPN)만 허용합니다. Cloudflare Tunnel을 쓰면 80/443도 열 필요가 없습니다.
- OS 보안 업데이트 자동 적용 (`unattended-upgrades`)
- 운영 비밀값은 `/srv/commit-health/.env`에 두고 권한 600, Git에는 절대 넣지 않습니다.

### 배포 방식

1. `main`에 머지되면 GitHub Actions(GitHub 호스팅 러너)가 web·server 이미지를 빌드해 **GHCR**에 push합니다. 서버에서 빌드하지 않으므로 서버 자원을 아낍니다.
2. 서버의 **self-hosted runner**가 이어서 `docker compose pull && docker compose up -d`를 실행합니다. runner는 서버에서 GitHub로 바깥 연결만 하므로 내부망에서도 동작합니다.
3. 배포 후 `/api/health`를 확인하고, 실패하면 이전 이미지 태그로 되돌립니다.

주의: self-hosted runner는 **`main` push 배포 작업에만** 연결합니다. `pull_request` 이벤트에서 이 runner를 쓰면 외부 PR의 코드가 운영 서버에서 실행될 수 있습니다. 배포 작업은 GitHub Environment(`production`)로 묶고, 저장소 설정에서 포크 PR의 워크플로 실행에 승인을 요구합니다.

## 권장 서버 사양

| 항목     | 최소                                                        | 권장           |
| -------- | ----------------------------------------------------------- | -------------- |
| CPU      | 2코어                                                       | 4코어          |
| 메모리   | 4GB                                                         | 8GB            |
| 디스크   | SSD 64GB                                                    | SSD 256GB 이상 |
| OS       | Ubuntu Server 24.04 LTS                                     |                |
| 네트워크 | 바깥 방향 HTTPS 연결 가능 (Tunnel 사용 시 이것만 있으면 됨) |                |

이미지 빌드를 CI에서 하므로 서버는 실행만 담당합니다. 위 사양이면 학교 규모 사용자는 충분히 감당합니다.

## 단계별 이전 계획

6단계 전까지는 기존 Vercel·Neon 운영을 그대로 유지합니다.

### 1단계 — 컨테이너화 (저장소 작업, 서버 없이 가능)

- `apps/web/Dockerfile` (`output: 'standalone'`), `apps/server/Dockerfile`
- 루트 `compose.yaml` (web, server, postgres, caddy) + `Caddyfile`
- 사진 저장용 `StorageService` 인터페이스와 로컬 디스크 구현
- 로컬에서 `docker compose up`으로 로그인 흐름까지 확인
- CI에 이미지 빌드 단계 추가

### 2단계 — 서버 준비

- Ubuntu 설치, 계정·SSH·방화벽·자동 업데이트 설정
- Docker Engine + Compose plugin 설치
- `/srv/commit-health/` 디렉터리 구조와 `.env` 작성
- 도메인 구매, Cloudflare DNS 연결, Tunnel 생성

### 3단계 — 백업·모니터링 먼저 구성

- 백업 스크립트와 외부 저장소 연결, 첫 복구 리허설
- 외부 업타임 모니터와 Discord 알림 연결

데이터가 들어오기 전에 백업부터 동작하는지 확인합니다.

### 4단계 — 배포 파이프라인과 스테이징

- GHCR push 워크플로, self-hosted runner 등록
- `staging.<도메인>`으로 먼저 띄우고, 스테이징용 Google OAuth 리디렉션 URI를 등록해 로그인·재로그인·로그아웃 검증

### 5단계 — 데이터 이전 리허설

- Neon direct 연결로 `pg_dump` → 서버 Postgres로 `pg_restore` → `prisma migrate status` 확인
- 현재 데이터는 `User`, `Session`, `OAuthAttempt`뿐이라 작습니다. 세션은 옮기지 않고 다시 로그인하게 해도 됩니다.

### 6단계 — 전환

1. 공지 후 짧은 점검 시간을 잡습니다.
2. Neon → 서버 Postgres 최종 덤프·복원을 실행합니다.
3. Google OAuth 운영 클라이언트에 새 콜백 `https://<도메인>/api/auth/google/callback`을 추가합니다.
4. 서버 `.env`의 `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL`을 새 도메인으로 맞춥니다.
5. Cloudflare Tunnel에 운영 도메인을 연결합니다.
6. [deployment.md](deployment.md)의 배포 후 확인 항목으로 검증합니다.

되돌리기: 사용자에게 기존 `commit-health.vercel.app` 주소를 다시 안내하면 됩니다. 전환 후 2주 동안 Vercel·Neon을 지우지 않습니다.

### 7단계 — 정리

- Vercel 두 프로젝트, Neon 프로젝트 삭제 (Neon은 최종 백업 후)
- 저장소에서 `apps/*/vercel.json`, `.vercelignore`, `next.config.ts` rewrite, `DATABASE_URL_UNPOOLED` 관련 설정 제거
- `docs/deployment.md`를 온프레미스 기준으로 다시 작성하고, 서버 접속·복구 절차를 담은 운영 문서(runbook) 추가
- `Project.md`의 배포 항목 갱신

## 확인이 필요한 사항

1. **서버 위치와 네트워크**: 학교 서버인지 개인 PC인지, 외부로 나가는 HTTPS 연결이 허용되는지, 학교 정책상 외부 공개 서비스를 운영해도 되는지 확인해야 합니다.
2. **서버 사양과 OS**: CPU, 메모리, 디스크 용량과 현재 설치된 OS
3. **도메인**: 새로 살지(연 1~2만 원), 학교 도메인의 하위 주소를 받을 수 있는지. Cloudflare Tunnel을 쓰려면 DNS를 Cloudflare로 옮길 수 있어야 합니다.
4. **관리 책임자**: 서버 장애·백업 확인을 누가 맡을지, 방학 중 서버 전원은 어떻게 할지
5. **백업 저장 위치**: R2, B2, 팀 Google Drive 중 어디에 둘지
