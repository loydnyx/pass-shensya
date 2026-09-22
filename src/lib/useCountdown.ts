import { useCallback, useEffect, useState } from "react";

/** 553 -> "9:13", 45 -> "0:45". */
export function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A spoken/plain-text version of a wait: "45 seconds", "about 10 minutes". */
export function describeWait(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/** The Retry-After header (in seconds) of a response, or null if missing or invalid. */
export function retryAfterSeconds(response: Response): number | null {
  const value = Number(response.headers.get("Retry-After"));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * A live countdown for rate-limit pauses.
 *
 * `startFromResponse(response)` starts it from a 429 response's Retry-After
 * header and returns true; for any other response it does nothing and returns
 * false, so callers can fall back to showing the server's message.
 *
 * It measures against the clock (not by counting ticks), so it stays correct
 * when the browser throttles timers in a background tab.
 */
export function useCountdown() {
  const [state, setState] = useState<{ endsAt: number; total: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const start = useCallback((seconds: number) => {
    const current = Date.now();
    setNow(current);
    setState({ endsAt: current + seconds * 1000, total: seconds });
  }, []);

  const startFromResponse = useCallback(
    (response: Response): boolean => {
      if (response.status !== 429) return false;
      const seconds = retryAfterSeconds(response);
      if (seconds === null) return false;
      start(seconds);
      return true;
    },
    [start],
  );

  useEffect(() => {
    if (!state) return;

    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= state.endsAt) setState(null);
    };

    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [state]);

  const secondsLeft = state ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : 0;

  return {
    secondsLeft,
    total: state?.total ?? 0,
    active: secondsLeft > 0,
    start,
    startFromResponse,
  };
}