import type { TimerEnvironment } from './activity-timer';

export const browserTimerEnvironment: TimerEnvironment = {
  now: () => performance.now(),
  visible: () => document.visibilityState === 'visible' && document.hasFocus(),
  every(callback) {
    const id = window.setInterval(callback, 250);
    return () => window.clearInterval(id);
  },
  onLeave(callback) {
    const hidden = () => {
      if (document.visibilityState !== 'visible') callback();
    };
    window.addEventListener('blur', callback);
    window.addEventListener('pagehide', callback);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', callback);
      window.removeEventListener('pagehide', callback);
      document.removeEventListener('visibilitychange', hidden);
    };
  },
};
