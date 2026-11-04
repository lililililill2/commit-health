import { cn } from '@/shared/lib';

export function ViewerStatus({ kind = 'loading' }: { kind?: 'loading' | 'error' | 'unsupported' }) {
  const loading = kind === 'loading';
  return (
    <div
      className={cn(
        'absolute inset-0 z-2 flex flex-col items-center justify-center gap-3 p-6',
        'bg-[rgb(230_239_240/94%)] text-center text-[#314957]',
      )}
      role={loading ? 'status' : 'alert'}
    >
      <p className="m-0 text-base font-medium">
        {loading
          ? '기숙사 모델을 불러오는 중…'
          : kind === 'unsupported'
            ? '이 브라우저에서는 3D 화면을 표시할 수 없어요.'
            : '기숙사 모델을 불러오지 못했어요.'}
      </p>
      {!loading && (
        <>
          <p className="m-0 max-w-[360px] text-sm leading-[1.6] break-keep text-[#607581]">
            {kind === 'unsupported'
              ? 'WebGL 2를 사용할 수 없어요. 브라우저의 그래픽 가속 설정을 확인하거나 다른 브라우저에서 열어 주세요.'
              : '모델 로딩이나 3D 화면 연결에 문제가 생겼어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'}
          </p>
          <button
            type="button"
            className={cn(
              'mt-2 min-h-11 cursor-pointer rounded-lg border border-[#7790a0] bg-transparent px-5 py-2.5 text-[14px] text-inherit',
              'focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-[#314957]',
            )}
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </>
      )}
    </div>
  );
}
