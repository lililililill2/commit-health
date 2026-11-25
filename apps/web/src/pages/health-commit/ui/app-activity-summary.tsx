export function AppActivitySummary() {
  return (
    <section
      aria-labelledby="app-activity-heading"
      className="relative mt-8 overflow-hidden rounded-xl border border-white/20 bg-white/5"
    >
      <h2 id="app-activity-heading" className="sr-only">
        걸음 수와 이동 거리
      </h2>
      <dl
        aria-hidden="true"
        className="grid min-h-60 gap-6 p-6 opacity-70 blur-[1px] select-none sm:min-h-52 sm:grid-cols-2"
      >
        <div>
          <dt className="text-base font-medium">걸음 수</dt>
          <dd className="mt-4 text-3xl font-medium">
            — <span className="text-sm font-normal">걸음</span>
          </dd>
        </div>
        <div>
          <dt className="text-base font-medium">이동 거리</dt>
          <dd className="mt-4 text-3xl font-medium">
            — <span className="text-sm font-normal">km</span>
          </dd>
        </div>
      </dl>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#111113]/35 p-6 text-center">
        <p id="app-connection-message" className="text-sm font-medium sm:text-base">
          해당 기능은 앱 연결이 필요합니다.
        </p>
        <button
          type="button"
          disabled
          aria-describedby="app-connection-message app-connection-status"
          className="min-h-11 rounded-lg bg-[#7db8ff] px-6 py-2.5 text-sm font-medium text-[#111113] disabled:cursor-not-allowed disabled:opacity-60"
        >
          연결하기
        </button>
        <p id="app-connection-status" className="sr-only">
          앱 연결 기능은 준비 중입니다.
        </p>
      </div>
    </section>
  );
}
