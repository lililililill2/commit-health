import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';

const layers = ['app', 'pages', 'widgets', 'features', 'entities', 'shared'];

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  prettier,
  ...layers.map((layer, index) => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...(index === 0 ? [] : layers.slice(0, layer === 'shared' ? index : index + 1)).map(
              (forbidden) => ({
                group: [`@/${forbidden}`, `@/${forbidden}/**`],
                message:
                  'FSD: 상위 레이어 또는 같은 레이어의 다른 slice를 import할 수 없습니다. 내부에서는 상대 경로를 사용하세요.',
              }),
            ),
            {
              group: ['@/pages/*/**', '@/widgets/*/**', '@/features/*/**', '@/entities/*/**'],
              message: 'FSD: 다른 slice는 index.ts public API를 통해 import하세요.',
            },
          ],
        },
      ],
    },
  })),
  globalIgnores(['.next/**', 'out/**', 'next-env.d.ts']),
]);
