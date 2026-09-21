import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared frame for the login, signup and recover pages: newspaper masthead,
 * content area and footer. All motion classes (ps-*) live in globals.css.
 */
type AuthShellProps = {
  /** Centre caption in the top bar (hidden on small screens). */
  caption: string;
  /** Line under the PASS-SHENSYA masthead. */
  subtitle: string;
  /** Right-hand caption in the footer. */
  footerCaption: string;
  /** Narrower column, used by the one-time Recovery Key screen. */
  narrow?: boolean;
  /** Removes links that leave the page while a one-time secret is on screen. */
  locked?: boolean;
  children: ReactNode;
};

export function AuthShell({
  caption,
  subtitle,
  footerCaption,
  narrow = false,
  locked = false,
  children,
}: AuthShellProps) {
  return (
    <main className="paper-grain ps-page-enter min-h-screen">
      <div
        className={`mx-auto flex min-h-screen w-full flex-col px-5 py-5 sm:px-8 lg:px-12 ${
          narrow ? "max-w-[1100px]" : "max-w-[1500px]"
        }`}
      >
        <header className="ps-masthead-reveal">
          <div className="rule-double" />

          <div className="flex items-center justify-between py-3">
            {locked ? (
              <span className="editorial-kicker">Pass-Shensya</span>
            ) : (
              <Link
                href="/"
                className="editorial-kicker transition-opacity hover:opacity-60"
              >
                Pass-Shensya
              </Link>
            )}

            <span className="editorial-caption hidden sm:block">{caption}</span>

            <span className="editorial-caption">Issue No. 001</span>
          </div>

          <div className="rule-thin" />

          <div className="py-6 text-center">
            <div className="editorial-masthead text-4xl sm:text-5xl">
              PASS-SHENSYA
            </div>

            <div className="mt-2 editorial-kicker">{subtitle}</div>
          </div>

          <div className="rule-double ps-rule-reveal" />
        </header>

        <div className="flex flex-1 items-center py-12 lg:py-16">{children}</div>

        <footer>
          <div className="rule-thin" />

          <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            {locked ? (
              <span className="editorial-caption">
                Keep your recovery key private.
              </span>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-2 text-xs text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              >
                <ArrowLeft size={13} />
                Back to front page
              </Link>
            )}

            <span className="editorial-caption">{footerCaption}</span>
          </div>
        </footer>
      </div>
    </main>
  );
}

/** The bordered card that holds a form. */
export function AuthPanel({
  kicker,
  title,
  icon,
  children,
}: {
  kicker: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ps-record-enter w-full border border-black/25 bg-[rgba(247,243,234,0.7)] p-6 [--ps-delay:120ms] sm:p-8">
      <div className="flex items-start justify-between border-b border-black/20 pb-5">
        <div>
          <div className="editorial-kicker">{kicker}</div>

          <h2 className="editorial-serif mt-2 text-2xl font-semibold">
            {title}
          </h2>
        </div>

        <div
          aria-hidden="true"
          className="flex h-10 w-10 items-center justify-center border border-black/20"
        >
          {icon}
        </div>
      </div>

      {children}
    </div>
  );
}

/** Inline notice used inside forms: an error (default) or a calmer informational note. */
export function AuthNotice({
  title,
  message,
  tone = "error",
}: {
  title: string;
  message: string;
  tone?: "error" | "info";
}) {
  const info = tone === "info";

  return (
    <div
      role={info ? "status" : "alert"}
      className={`border-l-2 px-4 py-3 ${
        info
          ? "border-[var(--ink)] bg-black/[0.03]"
          : "border-[var(--accent)] bg-[rgba(118,31,37,0.05)]"
      }`}
    >
      <div
        className={`editorial-kicker ${info ? "text-[var(--ink)]" : "text-[var(--accent)]"}`}
      >
        {title}
      </div>

      <p
        className={`mt-1 text-sm leading-5 ${
          info ? "text-[var(--muted)]" : "text-[var(--accent-dark)]"
        }`}
      >
        {message}
      </p>
    </div>
  );
}