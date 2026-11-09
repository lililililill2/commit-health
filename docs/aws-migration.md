# AWS 통합 시나리오 (초안)

## 왜 옮기나

현재 구성과 앞으로 추가될 기능이 서로 다른 플랫폼에 흩어져 있습니다.

| 역할           | 현재 / 예정                                 |
| -------------- | ------------------------------------------- |
| 웹 (Next.js)   | Vercel 프로젝트 1                           |
| API (NestJS)   | Vercel 프로젝트 2 (서버리스 함수)           |
| DB             | Neon (Singapore)                            |
| 급식 사진      | 미정 (Vercel Blob / S3 / R2 후보)           |
| 급식 API 배치  | 미정 (서버리스라 상시 스케줄러 없음)        |
| AI 판정·퀘스트 | 미정 (외부 AI API)                          |
| 비밀값         | Vercel 두 프로젝트 + 로컬 `.env.production` |

문제점

- 환경변수가 Vercel 프로젝트 2곳에 나뉘어 있고 배포 순서가 보장되지 않습니다.
- `/api` rewrite, pooled/unpooled 연결 구분, Corepack 설정처럼 플랫폼 조합 때문에 생긴 설정이 많습니다.
- 서버리스 환경이라 매일 밤 HP 판정이나 급식 수집 같은 정기 작업을 돌릴 곳이 없습니다.
- DB가 싱가포르에 있어 국내 사용자 기준 지연이 생깁니다.

## 목표 구성 (권장안: 단일 EC2 + RDS)

학생 프로젝트 규모(동시 사용자 수백 명 이하)와 비용을 기준으로, **서울 리전(`ap-northeast-2`) 한 곳에 모으는 가장 단순한 구성**을 권장합니다.

```text
                 Route 53 (도메인)
                        │
                 ┌──────▼───────────────────────── EC2 (t4g.small, Docker Compose)
  사용자 ─HTTPS─▶│ Caddy :443 (TLS 자동 발급)
                 │   ├─ /api/*  → server:8080  (NestJS + @nestjs/schedule)
                 │   └─ /*      → web:3000     (Next.js standalone)
                 └──────┬─────────────┬──────────────────────────────
                        │             │
              RDS PostgreSQL 17    S3 (급식 사진, presigned URL 업로드)
              (db.t4g.micro,
               private subnet)     Bedrock (AI 판정·퀘스트 생성, 선택)

  공통: SSM Parameter Store(비밀값) · CloudWatch Logs · ECR(이미지) · AWS Budgets(비용 알림)
  배포: GitHub Actions → OIDC로 AWS 인증 → ECR push → SSM Run Command로 EC2에서 compose pull/up
```

이 구성의 장점

- **같은 도메인에서 웹과 API를 함께 서비스**합니다. Caddy가 경로로 나누므로 Next.js rewrite와 `API_SERVER_ORIGIN`이 필요 없고, 세션 쿠키는 지금처럼 `SameSite=Lax`, `__Host-`를 그대로 씁니다.
- **서버가 항상 떠 있으므로** `@nestjs/schedule`로 급식 수집, 일일 HP 판정, 퀘스트 배정을 서버 안에서 처리할 수 있습니다.
- RDS는 커넥션 풀러가 필요 없어 `DATABASE_URL` 하나로 충분합니다.
- 비밀값은 Parameter Store 한 곳, 로그는 CloudWatch 한 곳에서 관리합니다.

### 예상 월 비용 (서울 리전, 대략치)

| 항목                             | 월 비용    |
| -------------------------------- | ---------- |
| EC2 t4g.small + EBS 20GB         | 약 $15     |
| 퍼블릭 IPv4 1개                  | 약 $3.6    |
| RDS db.t4g.micro + 20GB, 단일 AZ | 약 $15~18  |
| S3, ECR, CloudWatch, Route 53    | $2 이하    |
| **합계**                         | **약 $35** |

AI 호출 비용은 별도이며 사용량에 따라 달라집니다. 신규 계정의 프리 티어·크레딧, AWS Educate 등 학생 지원 프로그램을 적용하면 더 낮아질 수 있습니다. 실제 금액은 AWS Pricing Calculator로 확인합니다.

### 검토했지만 지금은 택하지 않은 안

| 안                            | 판단                                                                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| ECS Fargate + ALB             | 무중단 배포와 확장이 쉽지만 ALB 고정비 포함 월 $60 이상. 사용자가 늘면 이쪽으로 이전      |
| Amplify(웹) + Lambda(API)     | 관리형이지만 지금과 같은 "웹·API 분리 + 서버리스" 구조라 이번에 풀려는 문제가 그대로 남음 |
| Lightsail                     | 더 저렴하고 단순하지만 RDS·S3·IAM 연동이 번거로움. 비용이 최우선이면 대안                 |
| EC2 안에 PostgreSQL 직접 설치 | 가장 저렴하지만 백업·복구를 직접 책임져야 해서 비추천                                     |

## 단계별 이전 계획

각 단계는 이전 단계가 끝나야 시작하며, 6단계 전까지는 기존 Vercel·Neon 운영을 그대로 유지합니다.

### 1단계 — AWS 계정 기반 준비

- 루트 계정 MFA, IAM Identity Center로 팀원별 계정 발급
- AWS Budgets로 월 $40 초과 시 알림
- VPC: 퍼블릭 서브넷(EC2) + 프라이빗 서브넷(RDS), RDS 보안 그룹은 EC2에서 오는 5432만 허용
- 도메인 준비 (Route 53 구매 또는 기존 도메인 위임)

### 2단계 — 코드를 컨테이너로 실행할 수 있게 만들기

이 단계는 AWS와 무관하게 저장소에서 먼저 끝낼 수 있습니다.

- `apps/web/Dockerfile`: `next.config.ts`에 `output: 'standalone'`을 추가하고, 그 결과물만 담는 이미지
- `apps/server/Dockerfile`: `pnpm deploy --prod`로 서버 패키지만 추린 이미지, 시작 시 Prisma client 포함
- 루트 `compose.yaml` (web, server, caddy) + `Caddyfile`
- 로컬에서 `docker compose up`으로 로그인 흐름까지 확인
- CI에 이미지 빌드 단계 추가 (push는 아직 안 함)

### 3단계 — AWS 리소스 생성

- RDS PostgreSQL 17 (자동 백업 7일, 삭제 방지 켜기)
- S3 버킷 (퍼블릭 접근 차단, 수명 주기 규칙으로 오래된 사진 삭제)
- ECR 저장소 2개 (web, server)
- EC2 + Elastic IP, IAM 역할(ECR pull, S3 읽기·쓰기, SSM, CloudWatch Logs)
- Parameter Store에 운영 비밀값 등록 (`GOOGLE_CLIENT_SECRET`, `DATABASE_URL` 등)
- 가능하면 위 리소스를 Terraform이나 CDK로 코드화해 저장소에 둡니다.

### 4단계 — 배포 파이프라인

- GitHub Actions에 AWS OIDC 역할 연결 (액세스 키를 GitHub Secrets에 저장하지 않음)
- `main` 머지 시: 이미지 빌드 → ECR push → SSM Run Command로 EC2에서 `docker compose pull && up -d`
- 배포 후 `/api/health` 확인, 실패하면 이전 이미지 태그로 되돌리는 스크립트 추가
- 이때 임시 서브도메인(예: `staging.<도메인>`)으로 띄워 동작을 확인합니다.

### 5단계 — 데이터 이전과 리허설

- `pg_dump`(Neon direct 연결) → `pg_restore`(RDS)로 리허설한 뒤 `prisma migrate status`로 이력 확인
- 스테이징 도메인용 Google OAuth 리디렉션 URI를 추가하고 로그인, 재로그인, 로그아웃을 검증
- 현재 데이터는 `User`, `Session`, `OAuthAttempt`뿐입니다. 세션은 옮기지 않고 사용자에게 다시 로그인하게 하는 방법도 가능합니다.

### 6단계 — 전환 (cutover)

1. 공지 후 짧은 점검 시간을 잡습니다.
2. Neon → RDS 최종 덤프·복원을 실행합니다.
3. 운영 도메인 DNS를 EC2로 바꿉니다.
4. Google OAuth 운영 클라이언트에 새 콜백 `https://<도메인>/api/auth/google/callback`을 추가합니다.
5. 서버의 `FRONTEND_URL`, `CORS_ORIGIN`, `GOOGLE_CALLBACK_URL`을 새 도메인으로 바꿉니다.
6. [deployment.md](deployment.md)의 배포 후 확인 항목으로 검증합니다.

되돌리기: DNS를 Vercel로 되돌리면 됩니다. 이를 위해 전환 후 2주 동안은 Vercel·Neon을 지우지 않고 둡니다.

### 7단계 — 정리

- Vercel 두 프로젝트와 Neon 프로젝트 삭제 (Neon은 최종 백업을 받은 뒤 삭제)
- 저장소에서 `apps/*/vercel.json`, `.vercelignore`, `next.config.ts`의 rewrite, `DATABASE_URL_UNPOOLED` 관련 설정 제거
- `docs/deployment.md`를 AWS 기준으로 다시 작성하고, `Project.md`의 배포 항목을 갱신
- Google OAuth에서 기존 `commit-health.vercel.app` 콜백 제거

## 이전 후 기능 구현에 주는 영향

- **급식 사진**: 브라우저가 서버에서 받은 presigned URL로 S3에 직접 올리고, DB에는 `Upload.storageKey`만 저장합니다([data-model.md](data-model.md)).
- **급식 API·일일 판정**: NestJS 안의 `@nestjs/schedule` 작업으로 처리합니다. 서버가 한 대이므로 중복 실행 문제가 없습니다. 나중에 여러 대로 늘리면 EventBridge Scheduler로 옮깁니다.
- **AI**: Bedrock을 쓰면 키 관리 없이 EC2의 IAM 역할로 호출할 수 있고, 청구서도 AWS 하나로 모입니다. 다른 AI API를 쓰더라도 키는 Parameter Store에 둡니다.

## 결정이 필요한 사항

1. **도메인**: AWS로 옮기면 `commit-health.vercel.app`을 쓸 수 없습니다. 새 도메인을 살지, 학교 도메인의 하위 도메인을 받을 수 있는지 정해야 합니다.
2. **월 예산**: 약 $35를 감당할 수 있는지, 비용을 낼 계정과 사람이 누구인지 정해야 합니다.
3. **인프라 코드화 여부**: Terraform·CDK로 관리할지, 콘솔에서 직접 만들고 문서로만 남길지 정해야 합니다.
4. **AI 제공자**: Bedrock으로 통일할지, 다른 AI API를 쓸지 정해야 합니다.
