import { DormViewer } from '@/features/dorm-viewer';

export function ThreeDPreviewPage() {
  return (
    <main className="h-dvh">
      <h1 className="sr-only">기숙사 3D 미리보기</h1>
      <p className="sr-only">
        마우스 왼쪽 버튼으로 드래그해 회전하고 휠로 확대하거나 축소할 수 있습니다. 터치 화면에서는
        한 손가락으로 회전하고 두 손가락으로 확대하거나 축소할 수 있습니다.
      </p>
      <DormViewer />
    </main>
  );
}
