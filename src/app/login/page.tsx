"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AuthNotice, AuthPanel, AuthShell } from "@/components/AuthShell";
import LetterSeal from "@/components/LetterSeal";
import PasswordField from "@/components/PasswordField";

export default function LoginPage() {
  // /login?locked=1 is where the dashboard's auto-lock sends people.
  const wasLocked = useSearchParams().get("locked") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Unable to sign in.");
        return;
      }

      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      caption="Private Edition · Access"
      subtitle="The Private Password Archive"
      footerCaption="PASS-SHENSYA · PRIVATE EDITION"
    >
      <div className="grid w-full grid-cols-1 gap-12 lg:grid-cols-[1fr_480px] lg:gap-20">
        {/* Editorial side */}
        <section className="flex min-w-0 flex-col justify-center">
          <div className="editorial-kicker mb-6 text-[var(--accent)]">
            Private Access · Record 001
          </div>

          <h1 className="editorial-display max-w-3xl text-[clamp(4rem,8vw,7.5rem)] leading-[0.9]">
            <span className="sr-only">Open your private archive.</span>

            {/* The animated lock seal stands in for the capital "O" */}
            <span aria-hidden="true">
              <LetterSeal />
              pen your
              <br />
              private
              <br />
              archive.
            </span>
          </h1>

          <div className="mt-9 max-w-xl border-t border-black/25 pt-6">
            <p className="editorial-serif text-xl leading-relaxed text-[var(--muted)]">
              Sign in with your master password to access the credentials
              stored inside your Pass-Shensya vault.
            </p>
          </div>

          <div className="mt-10 hidden max-w-xl border-y border-black/15 py-5 sm:block">
            <div className="grid grid-cols-3 gap-5">
              <AccessNote label="01" text="Private vault" />
              <AccessNote label="02" text="Encrypted fields" />
              <AccessNote label="03" text="Personal access" />
            </div>
          </div>
        </section>

        {/* Form */}
        <section className="flex items-center">
          <AuthPanel
            kicker="Private Archive"
            title="Sign in"
            icon={<LockKeyhole size={17} strokeWidth={1.5} />}
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

              <PasswordField
                id="password"
                label="Master password"
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                placeholder="Enter your master password"
              />

              {wasLocked && !error && (
                <AuthNotice
                  tone="info"
                  title="Vault locked"
                  message="You were signed out after a period of inactivity. Sign in again to continue."
                />
              )}

              {error && <AuthNotice title="Archive Notice" message={error} />}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="editorial-button editorial-button-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Opening archive..." : "Open my vault"}

                  {!loading && <ArrowRight size={15} strokeWidth={1.8} />}
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-black/15 pt-5 text-center">
              <Link
                href="/recover"
                className="editorial-link text-xs font-medium uppercase tracking-wide"
              >
                Forgot your password?
              </Link>
            </div>

            <div className="mt-5 text-center">
              <span className="text-xs text-[var(--muted)]">
                New to Pass-Shensya?{" "}
              </span>

              <Link
                href="/signup"
                className="editorial-link text-xs font-semibold uppercase tracking-wide"
              >
                Create an archive
              </Link>
            </div>
          </AuthPanel>
        </section>
      </div>
    </AuthShell>
  );
}

function AccessNote({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="editorial-caption">{label}</div>

      <div className="mt-2 text-xs font-medium uppercase tracking-wide">
        {text}
      </div>
    </div>
  );
}