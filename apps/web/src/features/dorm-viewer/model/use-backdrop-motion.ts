'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const preference = window.matchMedia(REDUCED_MOTION);
  preference.addEventListener('change', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    preference.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

function getSnapshot() {
  return document.visibilityState === 'visible' && !window.matchMedia(REDUCED_MOTION).matches;
}

function getServerSnapshot() {
  return false;
}

export function useBackdropMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
