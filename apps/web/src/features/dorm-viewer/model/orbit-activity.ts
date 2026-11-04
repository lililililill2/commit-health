// Pointer release is followed by damping. Keep the UI hidden until changes settle.
export function createOrbitActivity(onActivityChange?: (active: boolean) => void, settleMs = 180) {
  let active = false;
  let dragging = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (timeout !== undefined) clearTimeout(timeout);
    timeout = undefined;
  };
  const setActive = (value: boolean) => {
    if (active === value) return;
    active = value;
    onActivityChange?.(value);
  };
  const settle = () => {
    clear();
    timeout = setTimeout(() => {
      timeout = undefined;
      setActive(false);
    }, settleMs);
  };

  return {
    start() {
      dragging = true;
      clear();
      setActive(true);
    },
    change() {
      // Initial fitting and resizing are not user interactions.
      if (!active || dragging) return;
      settle();
    },
    end() {
      dragging = false;
      if (active) settle();
    },
    dispose() {
      dragging = false;
      clear();
      setActive(false);
    },
  };
}
