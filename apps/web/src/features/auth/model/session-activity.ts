export const SESSION_ACTIVITY_INTERVAL_MS = 60_000;

interface ActivityOptions {
  now: () => number;
  visible: () => boolean;
  schedule: (callback: () => void, delay: number) => () => void;
  renew: (signal: AbortSignal) => Promise<unknown>;
  onError: (error: unknown) => void;
}

export function createSessionActivity(options: ActivityOptions) {
  let stopped = false;
  let dirty = false;
  let lastSent = -Infinity;
  let cancelScheduled: (() => void) | undefined;
  let pending: AbortController | undefined;

  function flush() {
    if (stopped || pending || !dirty || !options.visible()) return;
    const delay = lastSent + SESSION_ACTIVITY_INTERVAL_MS - options.now();
    if (delay > 0) {
      cancelScheduled ??= options.schedule(() => {
        cancelScheduled = undefined;
        flush();
      }, delay);
      return;
    }
    cancelScheduled?.();
    cancelScheduled = undefined;
    dirty = false;
    lastSent = options.now();
    const request = new AbortController();
    pending = request;
    void options
      .renew(request.signal)
      .catch((error: unknown) => {
        if (!stopped && !request.signal.aborted) options.onError(error);
      })
      .finally(() => {
        if (pending !== request) return;
        pending = undefined;
        flush();
      });
  }

  return {
    activity() {
      if (stopped || !options.visible()) return;
      dirty = true;
      flush();
    },
    stop() {
      stopped = true;
      cancelScheduled?.();
      pending?.abort();
    },
  };
}

interface ActivityDocument extends EventTarget {
  readonly visibilityState: string;
  hasFocus: () => boolean;
}

export function observeSessionActivity(
  doc: ActivityDocument,
  win: EventTarget,
  activity: () => void,
) {
  const notify = (event?: Event) => {
    if ((!event || event.isTrusted) && doc.visibilityState === 'visible' && doc.hasFocus())
      activity();
  };
  const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;
  for (const name of events) doc.addEventListener(name, notify, { passive: true, capture: true });
  doc.addEventListener('visibilitychange', notify);
  win.addEventListener('focus', notify);
  win.addEventListener('pageshow', notify);
  notify();
  return () => {
    for (const name of events) doc.removeEventListener(name, notify, { capture: true });
    doc.removeEventListener('visibilitychange', notify);
    win.removeEventListener('focus', notify);
    win.removeEventListener('pageshow', notify);
  };
}
