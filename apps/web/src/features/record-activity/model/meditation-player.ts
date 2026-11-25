type RecordStatus = 'pending' | 'saving' | 'saved' | 'retry';

interface PlayerState {
  phase: 'idle' | 'starting' | 'active' | 'finished';
  playback: 'waiting' | 'playing' | 'paused';
  seconds: number;
  position: number;
  record: RecordStatus;
  message: string;
}

interface Run {
  audio: HTMLAudioElement;
  bindings: AbortController;
  stopTick: () => void;
  id?: string;
  readyAt: number;
  lastPing: number;
  pinging: boolean;
  position: number;
}

export function playedSeconds(ranges: TimeRanges) {
  let total = 0;
  for (let index = 0; index < ranges.length; index++) {
    total += ranges.end(index) - ranges.start(index);
  }
  return Math.floor(total);
}

const initialState: PlayerState = {
  phase: 'idle',
  playback: 'paused',
  seconds: 0,
  position: 0,
  record: 'pending',
  message: '',
};

export function createMeditationPlayer({
  audioPath,
  minimumSeconds,
  api,
  now = () => performance.now(),
  every = (tick: () => void) => {
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  },
  onResult,
  describeError,
}: {
  audioPath: string;
  minimumSeconds: number;
  api: {
    start: () => Promise<{ id: string }>;
    heartbeat: (id: string) => Promise<unknown>;
    completeMeditation: (id: string, seconds: number) => Promise<unknown>;
    fail: (id: string) => Promise<unknown>;
  };
  now?: () => number;
  every?: (tick: () => void) => () => void;
  onResult: () => void;
  describeError: (error: unknown) => string;
}) {
  const listeners = new Set<() => void>();
  let state = initialState;
  let run: Run | undefined;

  function update(patch: Partial<PlayerState>) {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  }

  function readPlayback(current: Run) {
    if (current.bindings.signal.aborted || current.audio.seeking) return;
    current.position = current.audio.currentTime;
    const seconds = playedSeconds(current.audio.played);
    const position = Math.floor(current.position);
    if (seconds !== state.seconds || position !== state.position) update({ seconds, position });
  }

  function stopAudio(current: Run) {
    if (current.bindings.signal.aborted) return;
    current.bindings.abort();
    current.audio.pause();
    current.audio.removeAttribute('src');
    current.audio.load();
  }

  function detach(current: Run) {
    stopAudio(current);
    current.stopTick();
    run = undefined;
  }

  function abandon(id: string) {
    void api
      .fail(id)
      .catch(() => {})
      .finally(onResult);
  }

  async function save(current: Run, leaving = false) {
    if (
      !current.id ||
      state.seconds < minimumSeconds ||
      (!leaving && now() < current.readyAt) ||
      state.record === 'saving' ||
      state.record === 'saved'
    )
      return;
    update({ record: 'saving' });
    try {
      await api.completeMeditation(current.id, minimumSeconds);
      onResult();
      if (run === current) {
        update({ record: 'saved' });
        if (state.phase === 'finished') detach(current);
      }
    } catch {
      if (run === current) update({ record: 'retry' });
    }
  }

  function finish(message?: string) {
    if (!run || state.phase === 'finished') return;
    const current = run;
    current.audio.pause();
    readPlayback(current);
    stopAudio(current);
    const qualified = state.seconds >= minimumSeconds;
    update({
      phase: 'finished',
      playback: 'paused',
      message: message ?? (qualified ? '' : '3분 전에 종료되어 기록이 저장되지 않았어요.'),
    });
    if (!qualified || state.record === 'saved') {
      detach(current);
      if (!qualified && current.id) abandon(current.id);
    } else if (state.record === 'pending') {
      void save(current);
    }
  }

  function tick(current: Run) {
    readPlayback(current);
    if (state.record === 'pending') void save(current);
    if (
      !current.id ||
      state.record === 'saved' ||
      current.pinging ||
      now() - current.lastPing < 4_000
    )
      return;
    current.pinging = true;
    current.lastPing = now();
    void api
      .heartbeat(current.id)
      .catch(() => {
        if (run === current && state.seconds < minimumSeconds)
          finish('연결이 끊겨 기록을 저장하지 못했어요. 다시 시작해 주세요.');
      })
      .finally(() => {
        current.pinging = false;
      });
  }

  async function start(audio: HTMLAudioElement) {
    if (run) return;
    const bindings = new AbortController();
    const current: Run = {
      audio,
      bindings,
      stopTick: () => {},
      readyAt: Infinity,
      lastPing: now(),
      pinging: false,
      position: 0,
    };
    run = current;
    update({ ...initialState, phase: 'starting', playback: 'waiting' });
    const on = (event: string, handler: () => void) =>
      audio.addEventListener(event, handler, { signal: bindings.signal });
    on('playing', () => update({ playback: 'playing' }));
    on('waiting', () => update({ playback: 'waiting' }));
    on('pause', () => {
      readPlayback(current);
      update({ playback: 'paused' });
    });
    on('ended', () => finish());
    on('error', () => finish('안내 음성을 재생할 수 없어요. 다시 시작해 주세요.'));
    on('timeupdate', () => readPlayback(current));
    on('seeking', () => {
      if (Math.abs(audio.currentTime - current.position) > 0.05)
        audio.currentTime = current.position;
    });
    on('ratechange', () => {
      if (audio.playbackRate !== 1) audio.playbackRate = 1;
    });

    audio.src = audioPath;
    // Call play during the click so browsers receive the user's playback gesture.
    void audio.play().catch(() => {
      if (run === current && !bindings.signal.aborted)
        finish('안내 음성을 시작할 수 없어요. 다시 시작해 주세요.');
    });
    current.stopTick = every(() => tick(current));
    try {
      const session = await api.start();
      if (run !== current) {
        abandon(session.id);
        return;
      }
      current.id = session.id;
      current.lastPing = now();
      current.readyAt = current.lastPing + minimumSeconds * 1_000;
      update({ phase: 'active' });
    } catch (error) {
      if (run === current) finish(describeError(error));
    }
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    start,
    togglePlayback() {
      if (!run || state.phase !== 'active') return;
      const current = run;
      if (!current.audio.paused) current.audio.pause();
      else {
        update({ playback: 'waiting' });
        void current.audio.play().catch(() => {
          if (run === current && !current.bindings.signal.aborted)
            update({
              playback: 'paused',
              message: '음성을 다시 재생하지 못했어요. 재개를 눌러 주세요.',
            });
        });
      }
    },
    finish,
    retrySave() {
      if (run && state.record === 'retry') void save(run);
    },
    leave() {
      if (!run) return;
      const current = run;
      current.audio.pause();
      readPlayback(current);
      if (state.seconds >= minimumSeconds) void save(current, true);
      else if (current.id) abandon(current.id);
      detach(current);
      update(initialState);
    },
  };
}
