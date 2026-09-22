import { describeWait, formatCountdown } from "@/lib/useCountdown";

/**
 * A rate-limit pause with a live m:ss countdown and a draining rule.
 *
 * Screen readers get one calm sentence when it appears ("...try again in about
 * 10 minutes"); the ticking digits are hidden from them so they are not
 * re-announced every second.
 */
export default function RateLimitNotice({
  title = "Too many attempts",
  lead,
  secondsLeft,
  totalSeconds,
}: {
  title?: string;
  /** Text before the time, e.g. "You can try again in". */
  lead: string;
  secondsLeft: number;
  totalSeconds: number;
}) {
  const percent =
    totalSeconds > 0 ? Math.min(100, Math.max(0, (secondsLeft / totalSeconds) * 100)) : 0;

  return (
    <div
      role="alert"
      className="border-l-2 border-[var(--accent)] bg-[rgba(118,31,37,0.05)] px-4 py-3"
    >
      <div className="editorial-kicker text-[var(--accent)]">{title}</div>

      <p className="sr-only">{`${lead} ${describeWait(totalSeconds)}.`}</p>

      <p aria-hidden="true" className="mt-1 text-sm leading-5 text-[var(--accent-dark)]">
        {lead}
      </p>

      <p
        aria-hidden="true"
        className="mono-text mt-1 text-2xl font-semibold leading-none tabular-nums text-[var(--accent-dark)]"
      >
        {formatCountdown(secondsLeft)}
      </p>

      <div aria-hidden="true" className="mt-3 h-px w-full bg-[rgba(118,31,37,0.2)]">
        <div
          className="h-px bg-[var(--accent)] transition-[width] duration-300 ease-linear"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}