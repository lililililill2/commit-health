# Next.js 라우터 충돌 방지

이 디렉터리를 유지하세요. 루트 `pages/`가 없으면 Next.js가 FSD의 `src/pages/`를
Pages Router로 해석할 수 있습니다. 실제 라우트는 루트 `app/`에만 작성합니다.

최신 [FSD Next.js 가이드](https://feature-sliced.design/docs/guides/tech/with-nextjs)는
`src/_app`, `src/_pages` 명칭을 권장합니다. 이 프로젝트는 요청한 `src/app`, `src/pages`
명칭을 유지하기 위해 루트 `app/`와 이 `pages/`를 라우터 위치로 명시합니다.
여기에 라우트 파일을 추가하지 마세요.
