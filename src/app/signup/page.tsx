"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import { AuthNotice, AuthPanel, AuthShell } from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import RecoveryKeyPanel from "@/components/RecoveryKeyPanel";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [recoveryKey, setRecoveryKey] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to create your vault.");
        return;
      }

      setRecoveryKey(data.recoveryKey);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  /* ------------------------------------------------------------------ */
  /* ONE-TIME RECOVERY KEY SCREEN                                       */
  /* ------------------------------------------------------------------ */

  if (recoveryKey) {
    return (
      <AuthShell
        caption="Recovery Document · No. 001"
        subtitle="Private Recovery Archive"
        footerCaption="PASS-SHENSYA · RECOVERY DOCUMENT"
        narrow
        locked
      >
        <RecoveryKeyPanel
          recoveryKey={recoveryKey}
          kicker="Confidential Document"
          title="Keep this key."
          intro="Your Recovery Key is the primary cryptographic recovery method. Store it somewhere private and secure."
          onContinue={() => {
            window.location.href = "/dashboard";
          }}
        />
      </AuthShell>
    );
  }

  /* ------------------------------------------------------------------ */
  /* REGISTRATION FORM                                                  */
  /* ------------------------------------------------------------------ */

  return (
    <AuthShell
      caption="Private Edition · Registration"
      subtitle="The Private Password Archive"
      footerCaption="PASS-SHENSYA · PRIVATE EDITION"
    >
      <div className="grid w-full grid-cols-1 gap-12 lg:grid-cols-[1fr_520px] lg:gap-20">
        {/* Editorial introduction */}
        <section className="flex min-w-0 flex-col justify-center">
          <div className="editorial-kicker mb-6 text-[var(--accent)]">
            New Archive · Registration
          </div>

          <h1 className="editorial-display max-w-3xl text-[clamp(4rem,8vw,7.5rem)] leading-[0.9]">
            Create your
            <br />
            private
            <br />
            edition.
          </h1>

          <div className="mt-9 max-w-xl border-t border-black/25 pt-6">
            <p className="editorial-serif text-xl leading-relaxed text-[var(--muted)]">
              Create one master password. Keep the rest of your credentials
              organized inside your own protected archive.
            </p>
          </div>

          <div className="mt-10 flex max-w-xl items-start gap-4 border-y border-black/15 py-5">
            <KeyRound
              className="mt-1 shrink-0 text-[var(--accent)]"
              size={19}
              strokeWidth={1.5}
            />

            <p className="text-sm leading-6 text-[var(--muted)]">
              A Recovery Key is generated after registration. It is the
              primary cryptographic recovery method — if you lose both it and
              your master password, your vault cannot be recovered.
            </p>
          </div>
        </section>

        {/* Signup form */}
        <section className="flex items-center">
          <AuthPanel
            kicker="New Private Archive"
            title="Create account"
            icon={<KeyRound size={17} strokeWidth={1.5} />}
          >
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="displayName" className="editorial-label">
                  Display name
                </label>

                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="editorial-input"
                  placeholder="Your name"
                  minLength={2}
                  maxLength={60}
                  required
                />
              </div>

              <div>
                <label htmlFor="email" className="editorial-label">
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="editorial-input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <PasswordField
                id="password"
                label="Master password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                placeholder="Create your master password"
                minLength={14}
                hint="At least 14 characters. A long passphrase you can remember works best."
              >
                <PasswordStrengthMeter password={password} />
              </PasswordField>

              {error && (
                <AuthNotice title="Registration Notice" message={error} />
              )}

              <button
                type="submit"
                disabled={loading}
                className="editorial-button editorial-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Creating archive..." : "Create my vault"}

                {!loading && <ArrowRight size={15} />}
              </button>
            </form>

            <div className="mt-6 border-t border-black/15 pt-5 text-center">
              <span className="text-xs text-[var(--muted)]">
                Already have an archive?{" "}
              </span>

              <Link
                href="/login"
                className="editorial-link text-xs font-semibold uppercase tracking-wide"
              >
                Sign in
              </Link>
            </div>
          </AuthPanel>
        </section>
      </div>
    </AuthShell>
  );
}