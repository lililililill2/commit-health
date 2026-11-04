import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '기숙사 3D 미리보기 | Commit Health',
  description: '기숙사 3D 모델을 둘러보세요.',
};

export { ThreeDPreviewPage as default } from '@/pages/three-d-preview';
