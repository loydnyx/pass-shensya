"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, KeyRound, ShieldQuestion } from "lucide-react";
import { AuthNotice, AuthPanel, AuthShell } from "@/components/AuthShell";
import PasswordField from "@/components/PasswordField";
import PasswordStrengthMeter from "@/components/PasswordStrengthMeter";
import RateLimitNotice from "@/components/RateLimitNotice";
import { useCountdown } from "@/lib/useCountdown";
import RecoveryKeyPanel from "@/components/RecoveryKeyPanel";

export default function RecoverPage() {
  const [email, setEmail] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  // The Recovery Key is rotated after every recovery; this is the new one.
  const [newRecoveryKey, setNewRecoveryKey] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const lockout = useCountdown();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recoveryKey, newPassword }),
      });

      // 429: show a live countdown from the server's Retry-After time.
      if (lockout.startFromResponse(response)) return;

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to recover your vault.");
        return;
      }

      if (data.recoveryKey) {
        setNewRecoveryKey(data.recoveryKey);
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (newRecoveryKey) {
    return (
      <AuthShell
        caption="Recovery Complete"
        subtitle="Private Recovery Archive"
        footerCaption="PASS-SHENSYA · RECOVERY DOCUMENT"
        narrow
        locked
      >
        <RecoveryKeyPanel
          recoveryKey={newRecoveryKey}
          kicker="Access restored · Confidential Document"
          title="Your new key."
          intro="Your master password has been replaced and your vault is unlocked. For your protection, your Recovery Key has been replaced too."
          replacesPrevious
          onContinue={() => {
            window.location.href = "/dashboard";
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      caption="Recovery Office"
      subtitle="Private Recovery Archive"
      footerCaption="PASS-SHENSYA · RECOVERY OFFICE"
    >
      <div className="grid w-full grid-cols-1 gap-12 lg:grid-cols-[1fr_520px] lg:gap-20">
        {/* Editorial side */}
        <section className="flex min-w-0 flex-col justify-center">
          <div className="editorial-kicker mb-6 text-[var(--accent)]">
            Recovery Office · Confidential
          </div>

          <h1 className="editorial-display max-w-3xl text-[clamp(4rem,8vw,7.5rem)] leading-[0.9]">
            Restore
            <br />
            private
            <br />
            access.
          </h1>

          <div className="mt-9 max-w-xl border-t border-black/25 pt-6">
            <p className="editorial-serif text-xl leading-relaxed text-[var(--muted)]">
              Use the Recovery Key you received when you created your archive
              to set a new master password.
            </p>
          </div>

          <div className="mt-10 max-w-xl divide-y divide-black/15 border-y border-black/15">
            <div className="flex items-start gap-4 py-5">
              <ShieldQuestion
                className="mt-1 shrink-0"
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
              />

              <div>
                <div className="editorial-kicker">Recovery record</div>

                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  Your Recovery Key is sensitive information. Enter it only on
                  your trusted Pass-Shensya installation. Your vault entries
                  are not changed — only your master password is replaced.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 py-5">
              <KeyRound
                className="mt-1 shrink-0 text-[var(--accent)]"
                size={20}
                strokeWidth={1.5}
                aria-hidden="true"
              />

              <div>
                <div className="editorial-kicker text-[var(--accent)]">
                  Lost your Recovery Key?
                </div>

                <p className="mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
                  If you still remember your master password,{" "}
                  <Link href="/login" className="editorial-link">
                    sign in
                  </Link>{" "}
                  and generate a new Recovery Key from your vault. If you have
                  lost both, your vault cannot be recovered — your email
                  address alone cannot unlock it.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recovery form */}
        <section className="flex items-center">
          <AuthPanel
            kicker="Confidential Recovery"
            title="Restore access"
            icon={<KeyRound size={17} strokeWidth={1.5} />}
          >
            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
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

              <div>
                <label htmlFor="recoveryKey" className="editorial-label">
                  Recovery key
                </label>

                <input
                  id="recoveryKey"
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={recoveryKey}
                  onChange={(event) => setRecoveryKey(event.target.value)}
                  className="editorial-input mono-text uppercase tracking-wider"
                  placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                  required
                />
              </div>

              <div className="border-t border-black/15 pt-5">
                <PasswordField
                  id="newPassword"
                  label="New master password"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  placeholder="Create a new master password"
                  minLength={14}
                  hint="At least 14 characters. A long passphrase you can remember works best."
                >
                  <PasswordStrengthMeter password={newPassword} />
                </PasswordField>
              </div>

              {lockout.active && (
                <RateLimitNotice
                  lead="For your protection, recovery is paused. You can try again in"
                  secondsLeft={lockout.secondsLeft}
                  totalSeconds={lockout.total}
                />
              )}

              {error && <AuthNotice title="Recovery Notice" message={error} />}

              <button
                type="submit"
                disabled={loading || lockout.active}
                className="editorial-button editorial-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lockout.active
                  ? "Recovery paused"
                  : loading
                    ? "Restoring archive..."
                    : "Restore access"}

                {!loading && !lockout.active && <ArrowRight size={15} />}
              </button>
            </form>

            <div className="mt-6 border-t border-black/15 pt-5 text-center">
              <Link
                href="/login"
                className="editorial-link text-xs font-semibold uppercase tracking-wide"
              >
                Return to sign in
              </Link>
            </div>
          </AuthPanel>
        </section>
      </div>
    </AuthShell>
  );
}