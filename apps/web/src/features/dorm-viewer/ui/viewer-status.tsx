import styles from './dorm-viewer.module.css';

export function ViewerStatus({ kind = 'loading' }: { kind?: 'loading' | 'error' | 'unsupported' }) {
  const loading = kind === 'loading';
  return (
    <div className={styles.status} role={loading ? 'status' : 'alert'}>
      <p className={styles.message}>
        {loading
          ? '기숙사 모델을 불러오는 중…'
          : kind === 'unsupported'
            ? '이 브라우저에서는 3D 화면을 표시할 수 없어요.'
            : '기숙사 모델을 불러오지 못했어요.'}
      </p>
      {!loading && (
        <>
          <p className={styles.description}>
            {kind === 'unsupported'
              ? 'WebGL 2를 사용할 수 없어요. 브라우저의 그래픽 가속 설정을 확인하거나 다른 브라우저에서 열어 주세요.'
              : '모델 로딩이나 3D 화면 연결에 문제가 생겼어요. 연결 상태를 확인한 뒤 다시 시도해 주세요.'}
          </p>
          <button
            type="button"
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            다시 시도
          </button>
        </>
      )}
    </div>
  );
}
