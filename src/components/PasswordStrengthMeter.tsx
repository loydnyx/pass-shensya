"use client";

import {
  estimatePasswordStrength,
  STRENGTH_MAX_SCORE,
} from "@/lib/passwordStrength";

const STRENGTH_COLORS = [
  "bg-accent", // 0 · Very weak
  "bg-orange-600", // 1 · Weak
  "bg-amber-600", // 2 · Fair
  "bg-yellow-500", // 3 · Good
  "bg-lime-600", // 4 · Strong
  "bg-green-600", // 5 · Very strong
  "bg-green-700", // 6 · Excellent
];

export default function PasswordStrengthMeter({
  password,
}: {
  password: string;
}) {
  const { score, label } = estimatePasswordStrength(password);
  if (!password) return null;

  const percent = Math.max(8, (score / STRENGTH_MAX_SCORE) * 100);
  const color = STRENGTH_COLORS[score];

  return (
    <div className="mt-2" aria-live="polite">
      <div className="h-1.5 w-full overflow-hidden border border-rule-strong bg-paper-dark">
        <div
          className={`h-full transition-all duration-300 ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>

      <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-faded">
        {label}
      </p>
    </div>
  );
}