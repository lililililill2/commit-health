import { DormStage } from '@/widgets/dorm-stage';

export function ThreeDPreviewPage() {
  return (
    <DormStage title="기숙사 3D 미리보기">
      <p className="sr-only">
        마우스 왼쪽 버튼으로 드래그해 회전할 수 있습니다. 터치 화면에서는 한 손가락으로 드래그해
        회전할 수 있습니다.
      </p>
    </DormStage>
  );
}
