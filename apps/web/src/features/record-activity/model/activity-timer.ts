export interface TimerEnvironment {
  now: () => number;
  visible: () => boolean;
  every: (callback: () => void) => () => void;
  onLeave: (callback: () => void) => () => void;
}
interface TimerApi {
  start: () => Promise<{ id: string }>;
  heartbeat: (id: string) => Promise<unknown>;
  complete: (id: string) => Promise<unknown>;
  fail: (id: string) => Promise<unknown>;
}
export interface TimerState {
  phase: 'idle' | 'starting' | 'running' | 'saving' | 'completed' | 'failed';
  seconds: number;
  message: string;
}

export function createActivityTimer(options: {
  api: TimerApi;
  environment: TimerEnvironment;
  onResult: () => void;
  describeError?: (error: unknown) => string;
}) {
  const { api, environment: env } = options;
  let state: TimerState = { phase: 'idle', seconds: 0, message: '' };
  const listeners = new Set<() => void>();
  let generation = 0,
    sessionId: string | null = null,
    started = 0,
    lastTick = 0,
    lastPing = 0,
    pinging = false;
  let stopTick = () => {},
    stopLeave = () => {};
  const update = (patch: Partial<TimerState>) => {
    const next = { ...state, ...patch };
    if (
      next.phase === state.phase &&
      next.seconds === state.seconds &&
      next.message === state.message
    )
      return;
    state = next;
    listeners.forEach((listener) => listener());
  };
  const detach = () => {
    stopTick();
    stopLeave();
    stopTick = stopLeave = () => {};
  };
  const reportFailure = (id: string) => {
    void api
      .fail(id)
      .catch(() => {})
      .finally(options.onResult);
  };
  function interrupt(message = '화면을 벗어나 이번 측정은 실패했어요.') {
    if (state.phase !== 'starting' && state.phase !== 'running') return;
    detach();
    update({ phase: 'failed', message });
    if (sessionId) reportFailure(sessionId);
  }
  async function complete() {
    if (state.phase !== 'running' || !sessionId || state.seconds < 1) return;
    const id = sessionId,
      run = generation;
    detach();
    update({ phase: 'saving' });
    try {
      await api.complete(id);
      if (run === generation) update({ phase: 'completed', message: '기록을 저장했어요.' });
      options.onResult();
    } catch {
      if (run === generation)
        update({
          phase: 'failed',
          message: '기록 저장을 확인하지 못했어요. 목록에서 확인해 주세요.',
        });
      reportFailure(id);
    }
  }
  function tick(run: number) {
    if (run !== generation || state.phase !== 'running') return;
    const now = env.now();
    if (!env.visible() || now - lastTick >= 15_000) {
      interrupt('화면이나 연결이 중단되어 이번 측정은 실패했어요.');
      return;
    }
    lastTick = now;
    update({ seconds: Math.max(0, Math.floor((now - started) / 1_000)) });
    if (now - lastPing >= 4_000 && !pinging && sessionId) {
      pinging = true;
      lastPing = now;
      void api
        .heartbeat(sessionId)
        .catch(() => {
          if (run === generation) interrupt('연결이 끊겨 이번 측정은 실패했어요.');
        })
        .finally(() => {
          if (run === generation) pinging = false;
        });
    }
  }
  async function start() {
    if (['starting', 'running', 'saving'].includes(state.phase)) return;
    if (!env.visible()) {
      update({ phase: 'failed', message: '이 화면을 활성화한 뒤 시작해 주세요.' });
      return;
    }
    const run = ++generation;
    sessionId = null;
    pinging = false;
    update({ phase: 'starting', seconds: 0, message: '' });
    stopLeave = env.onLeave(() => {
      if (run === generation) interrupt();
    });
    try {
      const session = await api.start();
      if (run !== generation || state.phase !== 'starting' || !env.visible()) {
        reportFailure(session.id);
        if (run === generation) interrupt();
        return;
      }
      sessionId = session.id;
      started = lastTick = lastPing = env.now();
      update({ phase: 'running' });
      stopTick = env.every(() => tick(run));
    } catch (error) {
      if (run !== generation || state.phase !== 'starting') return;
      detach();
      update({
        phase: 'failed',
        message: options.describeError?.(error) ?? '시작하지 못했어요. 다시 시도해 주세요.',
      });
    }
  }
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    start,
    complete,
    cancel: () => interrupt('직접 중단하여 이번 측정은 실패했어요.'),
    dispose() {
      interrupt();
      generation++;
      detach();
    },
  };
}
