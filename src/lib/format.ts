/** Trims and lowercases an email so the same address always matches, regardless of casing or stray whitespace. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes a user-entered recovery key (tolerating spaces, dashes, mixed
 * case) into the canonical "XXXX-XXXX-..." form, or returns null if it
 * isn't well-formed. Never throws on malformed input — callers must check
 * for null and fail cleanly (a generic "invalid" response), not crash.
 */
export function normalizeRecoveryKey(input: string): string | null {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().toUpperCase().replace(/[\s-]/g, "");
  if (!/^[0-9A-F]{32}$/.test(cleaned)) return null;
  const groups = cleaned.match(/.{4}/g);
  if (!groups || groups.length !== 8) return null;
  return groups.join("-");
}