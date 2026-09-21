"use client";

import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  minLength?: number;
  /** Small helper text under the field. */
  hint?: string;
  /** Extra content under the hint, e.g. a strength meter. */
  children?: ReactNode;
};

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  placeholder,
  minLength,
  hint,
  children,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="editorial-label">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="editorial-input pr-12"
          placeholder={placeholder}
          minLength={minLength}
          required
        />

        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="absolute right-0 top-0 flex h-full w-11 items-center justify-center text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? (
            <EyeOff size={17} strokeWidth={1.6} />
          ) : (
            <Eye size={17} strokeWidth={1.6} />
          )}
        </button>
      </div>

      {hint && (
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</p>
      )}

      {children}
    </div>
  );
}