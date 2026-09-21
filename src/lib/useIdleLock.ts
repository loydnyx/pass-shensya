import { useCallback, useEffect, useRef, useState } from "react";

const WARNING_MS = 30_000; // show a countdown for the last 30 seconds
const TICK_MS = 1_000;
const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "wheel",
  "scroll",
  "touchstart",
] as const;

/**
 * Calls `onLock` once the user has been idle for `timeoutMs`.
 *
 * Idle = no pointer, keyboard, scroll or touch activity. During the last
 * 30 seconds `secondsLeft` is set so the UI can warn; any activity (or
 * `reset()`) cancels the countdown. Timers in background tabs are throttled
 * by browsers, so the check also runs the moment the tab becomes visible.
 */
export function useIdleLock({
  timeoutMs,
  enabled,
  onLock,
}: {
  timeoutMs: number;
  enabled: boolean;
  onLock: () => void;
}): { secondsLeft: number | null; reset: () => void } {
  const lastActivity = useRef(Date.now());
  const onLockRef = useRef(onLock);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    onLockRef.current = onLock;
  });

  const reset = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSecondsLeft(null);
      return;
    }

    lastActivity.current = Date.now();
    let fired = false;

    const mark = () => {
      lastActivity.current = Date.now();
    };

    const tick = () => {
      if (fired) return;

      const remaining = timeoutMs - (Date.now() - lastActivity.current);

      if (remaining <= 0) {
        fired = true;
        setSecondsLeft(0);
        onLockRef.current();
        return;
      }

      setSecondsLeft(remaining <= WARNING_MS ? Math.ceil(remaining / 1000) : null);
    };

    for (const name of ACTIVITY_EVENTS) {
      window.addEventListener(name, mark, { passive: true });
    }
    document.addEventListener("visibilitychange", tick);
    const interval = window.setInterval(tick, TICK_MS);

    return () => {
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, mark);
      document.removeEventListener("visibilitychange", tick);
      window.clearInterval(interval);
    };
  }, [enabled, timeoutMs]);

  return { secondsLeft, reset };
}