/**
 * A dependency-free, heuristic password strength estimate — not as precise
 * as a real entropy library (e.g. zxcvbn), but good enough to nudge people
 * away from short, low-variety passwords without adding a package.
 *
 * Pure (no React), so it can be shared by the strength meter and the
 * vault's password-health check.
 */
export const STRENGTH_MAX_SCORE = 6;

const LABELS = [
  "Very weak",
  "Weak",
  "Fair",
  "Good",
  "Strong",
  "Very strong",
  "Excellent",
];

export function estimatePasswordStrength(password: string): {
  score: number;
  label: string;
} {
  if (!password) return { score: 0, label: "" };

  let score = 0;
  const length = password.length;
  if (length >= 8) score++;
  if (length >= 12) score++;
  if (length >= 16) score++;

  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  const varietyCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(
    Boolean,
  ).length;
  score += Math.max(0, varietyCount - 1);

  if (/(.)\1{2,}/.test(password)) score -= 1;
  if (/^(?:abc|123|qwerty|password|letmein)/i.test(password)) score -= 2;

  score = Math.max(0, Math.min(score, STRENGTH_MAX_SCORE));
  return { score, label: LABELS[score] };
}