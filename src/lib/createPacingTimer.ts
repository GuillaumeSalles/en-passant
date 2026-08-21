export type PacingTimer = {
  cancel: () => void;
  schedule: (durationMs: number, onElapsed: () => void) => void;
};

export function createPacingTimer(): PacingTimer {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const cancel = () => {
    if (timeout === undefined) return;
    clearTimeout(timeout);
    timeout = undefined;
  };

  return {
    cancel,
    schedule: (durationMs, onElapsed) => {
      cancel();
      timeout = setTimeout(() => {
        timeout = undefined;
        onElapsed();
      }, durationMs);
    },
  };
}
