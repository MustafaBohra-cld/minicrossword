export function createTimer(options = {}) {
  let base = Number.isFinite(options.elapsed) ? Math.max(0, options.elapsed) : 0;
  let startedAt = options.running ? Date.now() : null;

  return {
    start() {
      if (startedAt == null) startedAt = Date.now();
    },
    stop() {
      if (startedAt != null) {
        base += Date.now() - startedAt;
        startedAt = null;
      }
    },
    reset(ms = 0) {
      base = Math.max(0, ms || 0);
      startedAt = null;
    },
    isRunning() {
      return startedAt != null;
    },
    millis() {
      return base + (startedAt != null ? Date.now() - startedAt : 0);
    },
  };
}

export function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
