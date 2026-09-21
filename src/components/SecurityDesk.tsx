"use client";

import { Clock, KeyRound, ShieldCheck } from "lucide-react";
import type { HealthFilter, HealthFlag, VaultHealth } from "@/lib/passwordHealth";

export const AUTO_LOCK_OPTIONS = [5, 10, 15, 30] as const;
export const DEFAULT_AUTO_LOCK_MINUTES = 10;
export const AUTO_LOCK_STORAGE_KEY = "ps:autolock-minutes";

type SecurityDeskProps = {
  health: VaultHealth;
  loading: boolean;
  activeFilter: HealthFilter;
  onFilter: (filter: HealthFilter) => void;
  autoLockMinutes: number;
  onAutoLockChange: (minutes: number) => void;
  onRegenerateRecovery: () => void;
};

const FILTERS: { flag: HealthFlag; label: string; hint: string }[] = [
  { flag: "weak", label: "Weak", hint: "Short or low-variety passwords" },
  { flag: "reused", label: "Reused", hint: "The same password on more than one entry" },
  { flag: "old", label: "Not updated", hint: "Not edited in over a year" },
];

/** Password health, auto-lock and Recovery Key controls in one place. */
export default function SecurityDesk({
  health,
  loading,
  activeFilter,
  onFilter,
  autoLockMinutes,
  onAutoLockChange,
  onRegenerateRecovery,
}: SecurityDeskProps) {
  const isEmpty = !loading && health.total === 0;

  return (
    <section
      aria-labelledby="security-desk-title"
      className="border-b border-rule-strong py-8"
    >
      <div className="mb-6 flex items-center gap-4">
        <p id="security-desk-title" className="editorial-kicker">
          Security desk
        </p>
        <span className="h-px flex-1 bg-rule" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-0">
        {/* ------------------------------ Password health */}
        <div className="lg:border-r lg:border-rule lg:pr-8">
          <div className="flex items-center gap-2.5">
            <ShieldCheck size={15} strokeWidth={1.5} />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
              Password health
            </span>
          </div>

          <div className="mt-4 flex items-end gap-4">
            <span className="editorial-display text-5xl leading-none">
              {loading ? "—" : `${health.score}%`}
            </span>

            <span className="pb-1 font-mono text-[9px] uppercase leading-4 tracking-[0.12em] text-ink-faded">
              {loading
                ? "Checking"
                : isEmpty
                  ? "No entries yet"
                  : `${health.total - health.flagged} of ${health.total} entries clean`}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {FILTERS.map(({ flag, label, hint }) => {
              const count = health.counts[flag];
              const active = activeFilter === flag;

              return (
                <button
                  key={flag}
                  type="button"
                  title={hint}
                  aria-pressed={active}
                  disabled={loading || (count === 0 && !active)}
                  onClick={() => onFilter(active ? "all" : flag)}
                  className={`inline-flex min-h-[34px] items-center gap-2 border px-3 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    active
                      ? "border-accent bg-accent text-paper-light"
                      : "border-ink bg-transparent text-ink hover:bg-paper-dark"
                  }`}
                >
                  {label}
                  <span className="font-semibold">{count}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 max-w-md font-serif text-xs leading-5 text-ink-muted">
            Checked in this browser only. Your passwords are never sent anywhere
            to be analysed. Select a filter to list the affected entries.
          </p>
        </div>

        {/* ------------------------------ Auto-lock */}
        <div className="lg:border-r lg:border-rule lg:px-8">
          <div className="flex items-center gap-2.5">
            <Clock size={15} strokeWidth={1.5} />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
              Auto-lock
            </span>
          </div>

          <div
            role="group"
            aria-label="Auto-lock after inactivity"
            className="mt-4 inline-flex border border-ink"
          >
            {AUTO_LOCK_OPTIONS.map((minutes) => {
              const active = autoLockMinutes === minutes;

              return (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onAutoLockChange(minutes)}
                  className={`min-h-[38px] min-w-[52px] border-r border-ink px-3 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors last:border-r-0 ${
                    active
                      ? "bg-ink text-paper-light"
                      : "bg-transparent text-ink hover:bg-paper-dark"
                  }`}
                >
                  {minutes}m
                </button>
              );
            })}
          </div>

          <p className="mt-4 max-w-xs font-serif text-xs leading-5 text-ink-muted">
            You are signed out after this much inactivity, and asked for your
            master password again.
          </p>
        </div>

        {/* ------------------------------ Recovery Key */}
        <div className="lg:pl-8">
          <div className="flex items-center gap-2.5">
            <KeyRound size={15} strokeWidth={1.5} />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
              Recovery Key
            </span>
          </div>

          <p className="mt-4 max-w-xs font-serif text-xs leading-5 text-ink-muted">
            Your Recovery Key is the primary cryptographic recovery method.
            Replace it if you have lost it or think it may have been exposed.
            The old key stops working immediately.
          </p>

          <button
            type="button"
            onClick={onRegenerateRecovery}
            className="editorial-button editorial-button-secondary mt-4"
          >
            <KeyRound size={14} />
            Regenerate key
          </button>
        </div>
      </div>
    </section>
  );
}