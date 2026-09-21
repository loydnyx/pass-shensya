import { estimatePasswordStrength } from "./passwordStrength";

/**
 * Password health for the vault, computed entirely in the browser from the
 * entries that are already decrypted in memory. Nothing here is sent to a
 * server or to any third-party service.
 */
export type HealthFlag = "weak" | "reused" | "old";
export type HealthFilter = "all" | HealthFlag;

type HealthEntry = { id: string; password: string; updatedAt: string };

/** Strength score (0–6) at or below which a password counts as weak: Very weak, Weak, Fair. */
export const WEAK_MAX_SCORE = 2;

/**
 * "Old" means the entry has not been edited for this long. It is based on the
 * entry's updatedAt, which also moves when any field is edited (not only the
 * password), so treat it as a reminder rather than an exact password age.
 */
export const OLD_AFTER_DAYS = 365;

export type VaultHealth = {
  /** Only entries with at least one flag appear here. */
  flags: Map<string, HealthFlag[]>;
  counts: Record<HealthFlag, number>;
  total: number;
  flagged: number;
  /** Share of entries with no flags, 0–100 (100 for an empty vault). */
  score: number;
};

export function analyzeVault(entries: HealthEntry[], now: number = Date.now()): VaultHealth {
  // Group by exact password to find reuse.
  const byPassword = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.password) continue;
    byPassword.set(entry.password, (byPassword.get(entry.password) ?? 0) + 1);
  }

  const flags = new Map<string, HealthFlag[]>();
  const counts: Record<HealthFlag, number> = { weak: 0, reused: 0, old: 0 };
  const oldAfterMs = OLD_AFTER_DAYS * 24 * 60 * 60 * 1000;

  for (const entry of entries) {
    const entryFlags: HealthFlag[] = [];

    if (entry.password && estimatePasswordStrength(entry.password).score <= WEAK_MAX_SCORE) {
      entryFlags.push("weak");
    }

    if (entry.password && (byPassword.get(entry.password) ?? 0) > 1) {
      entryFlags.push("reused");
    }

    const updated = Date.parse(entry.updatedAt);
    if (Number.isFinite(updated) && now - updated > oldAfterMs) {
      entryFlags.push("old");
    }

    if (entryFlags.length > 0) {
      flags.set(entry.id, entryFlags);
      for (const flag of entryFlags) counts[flag] += 1;
    }
  }

  const total = entries.length;
  const flagged = flags.size;
  const score = total === 0 ? 100 : Math.round(((total - flagged) / total) * 100);

  return { flags, counts, total, flagged, score };
}