import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Fingerprint,
  Lock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

/**
 * Server Component. No hooks, no browser APIs, no styled-jsx.
 * All motion (ps-*) lives in globals.css.
 */
export default function HomePage() {
  return (
    <main className="paper-grain ps-page-enter min-h-screen overflow-hidden">
      {/* =====================================================
          MASTHEAD
          ===================================================== */}

      <header className="mx-auto w-full max-w-[1500px] px-5 py-5 sm:px-8 lg:px-12">
        <div className="rule-double" />

        <div className="flex items-center justify-between py-3">
          <div className="editorial-kicker">Private digital archive</div>

          <div className="editorial-kicker text-right">
            Secure edition · No. 001
          </div>
        </div>

        <div className="rule-thin" />

        <div className="ps-masthead-reveal relative py-7 text-center sm:py-8">
          <div className="absolute left-0 top-1/2 hidden -translate-y-1/2 lg:block">
            <div className="editorial-caption text-left">
              Vol. I
              <br />
              No. 001
            </div>
          </div>

          <div className="editorial-masthead text-[clamp(2.6rem,10vw,8.8rem)] leading-[0.8]">
            PASS-SHENSYA
          </div>

          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-black/30 sm:w-16" />
            <span className="editorial-kicker">
              The Private Password Archive
            </span>
            <span className="h-px w-8 bg-black/30 sm:w-16" />
          </div>
        </div>

        <div className="rule-double" />
      </header>

      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="mx-auto grid w-full max-w-[1500px] grid-cols-1 px-5 pb-16 pt-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-12 lg:pb-24 lg:pt-16">
        <div className="min-w-0 lg:pr-12">
          <div className="editorial-kicker mb-5 text-[var(--accent)]">
            Private Password Archive
          </div>

          <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
            {/* Lock seal — motion defined in globals.css */}
            <div className="ps-lock-float relative flex h-14 w-14 shrink-0 items-center justify-center sm:h-20 sm:w-20 lg:h-28 lg:w-28">
              <span
                aria-hidden="true"
                className="lock-seal-ring ps-lock-ring absolute inset-0 rounded-full"
              />

              <div className="ps-lock-core relative flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--paper-light)] sm:h-16 sm:w-16 lg:h-[5.25rem] lg:w-[5.25rem]">
                <Lock
                  aria-hidden="true"
                  strokeWidth={1.3}
                  className="h-5 w-5 text-[var(--ink)] sm:h-7 sm:w-7 lg:h-9 lg:w-9"
                />
              </div>
            </div>

            <h1 className="editorial-display min-w-0 text-[clamp(3rem,9vw,8.5rem)] leading-[0.86]">
              YOUR
              <br />
              PRIVATE
              <br />
              ARCHIVE.
            </h1>
          </div>

          <div className="mt-10 grid max-w-4xl grid-cols-1 gap-8 border-t border-black/25 pt-7 sm:grid-cols-[1.5fr_1fr]">
            <p className="editorial-serif text-xl leading-relaxed sm:text-2xl">
              One place for the credentials that matter most. Pass-Shensya
              keeps your usernames, passwords, and notes organized inside a
              protected private vault.
            </p>

            <p className="text-sm leading-7 text-[var(--muted)]">
              A randomly generated 256-bit vault key protects your data, and
              that key is itself protected by a key derived from your master
              password.
            </p>
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="editorial-button editorial-button-primary"
            >
              Create your archive
              <ArrowRight size={15} strokeWidth={1.8} />
            </Link>

            <Link
              href="/login"
              className="editorial-button editorial-button-secondary"
            >
              Sign in
            </Link>
          </div>

          <div className="rule-thin mt-10" />

          <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2">
            <span className="archive-label">Encrypted</span>
            <span className="archive-label">Authenticated</span>
            <span className="archive-label">Private</span>
          </div>
        </div>

        {/* ---------- Archive status ---------- */}
        <aside
          aria-label="Archive status"
          className="mt-14 border-t border-black/30 pt-7 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-9 lg:pt-0"
        >
          <div className="flex items-center justify-between">
            <span className="editorial-kicker">Archive status</span>
            <span className="classified-stamp">Private</span>
          </div>

          <dl className="mt-7 divide-y divide-black/15 border-y border-black/25">
            <StatusRow label="Vault data" value="AES-256-GCM" />
            <StatusRow label="Vault key" value="Random 256-bit" />
            <StatusRow label="Password hash" value="bcrypt" />
            <StatusRow label="Session" value="JWE / A256GCM" />
          </dl>

          <div className="mt-8 bg-[var(--ink)] p-5 text-[var(--paper-light)]">
            <div className="editorial-kicker text-white/60">
              Archive notice
            </div>

            <p className="editorial-serif mt-4 text-lg leading-relaxed">
              Your credentials belong in one organized place — not scattered
              across browsers, notes, and memory.
            </p>

            <div className="mt-6 border-t border-white/20 pt-4">
              <span className="editorial-caption text-white/50">
                Pass-Shensya · Personal Edition
              </span>
            </div>
          </div>
        </aside>
      </section>

      {/* =====================================================
          SECURITY REPORT
          ===================================================== */}

      <section className="border-y border-black/20 bg-[var(--paper-dark)]">
        <div className="mx-auto grid w-full max-w-[1500px] grid-cols-1 px-5 sm:px-8 lg:grid-cols-[220px_1fr_220px] lg:px-12">
          <div className="border-b border-black/15 py-7 lg:border-b-0 lg:border-r lg:pr-8">
            <div className="editorial-kicker">Security report</div>
            <div className="editorial-display mt-3 text-4xl">No. 001</div>
          </div>

          <div className="py-8 lg:px-10">
            <p className="editorial-serif max-w-3xl text-2xl leading-relaxed sm:text-3xl">
              Sensitive vault fields are encrypted and authenticated before
              database storage.
            </p>

            <p className="mt-5 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              Your master password is used to unlock the vault — it is not
              stored in plaintext.
            </p>
          </div>

          <div className="border-t border-black/15 py-7 lg:border-l lg:border-t-0 lg:pl-8">
            <div className="editorial-caption">Vault status</div>

            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="mono-text text-xs font-semibold uppercase tracking-widest">
                Protected
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          FEATURE / EDITORIAL GRID
          ===================================================== */}

      <section className="mx-auto w-full max-w-[1500px] px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
        <div className="mb-8 flex items-center gap-4">
          <span className="editorial-kicker">In this edition</span>
          <span className="h-px flex-1 bg-black/25" />
        </div>

        <div className="grid grid-cols-1 gap-px border border-black/25 bg-black/25 md:grid-cols-2 lg:grid-cols-4">
          <Feature
            number="01"
            icon={<Lock size={17} strokeWidth={1.5} />}
            title="Encrypted at storage"
            text="Sensitive vault fields are encrypted and authenticated before database storage."
          />

          <Feature
            number="02"
            icon={<RefreshCw size={17} strokeWidth={1.5} />}
            title="Built-in generator"
            text="Create strong, random passwords directly inside your private archive."
          />

          <Feature
            number="03"
            icon={<Fingerprint size={17} strokeWidth={1.5} />}
            title="Recovery Key"
            text="Your Recovery Key is the primary cryptographic recovery method. Keep it somewhere safe."
          />

          <Feature
            number="04"
            icon={<ShieldCheck size={17} strokeWidth={1.5} />}
            title="Master password"
            text="Your master password unlocks the vault key that protects your data."
          />
        </div>
      </section>

      {/* =====================================================
          FINAL CTA
          ===================================================== */}

      <section className="border-y border-black/30 bg-[var(--ink)] text-[var(--paper-light)]">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-8 px-5 py-14 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-20">
          <div className="min-w-0">
            <div className="editorial-kicker text-white/60">
              Begin your archive
            </div>

            <h2 className="editorial-display mt-4 text-[clamp(2.75rem,7vw,6rem)] leading-[0.9]">
              KEEP EVERYTHING
              <br />
              IN ONE PLACE.
            </h2>
          </div>

          <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="editorial-button border-[var(--paper-light)] bg-[var(--paper-light)] text-[var(--ink)] hover:bg-[var(--paper-dark)]"
            >
              Create your archive
              <ArrowRight size={15} strokeWidth={1.8} />
            </Link>

            <Link
              href="/login"
              className="editorial-button border-white/40 bg-transparent text-[var(--paper-light)] hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* =====================================================
          FOOTER
          ===================================================== */}

      <footer className="mx-auto w-full max-w-[1500px] px-5 py-8 sm:px-8 lg:px-12">
        <div className="rule-double" />

        <div className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="editorial-masthead text-2xl">PASS-SHENSYA</div>

            <div className="editorial-caption mt-1">
              Your credentials, kept under lock.
            </div>
          </div>

          <div className="editorial-caption">
            Private Edition · {new Date().getFullYear()}
          </div>
        </div>

        <div className="rule-thin pt-4">
          <p className="editorial-caption">
            Store carefully. Remember your master password. Keep your Recovery
            Key safe.
          </p>
        </div>

        <a
          href="https://www.flaticon.com/free-icons/lock"
          title="lock icons"
          style={{ fontSize: '10px', fontFamily: 'Times New Roman, Times, serif' }}
        >
          Lock icons created by Pixel perfect - Flaticon
        </a>

      </footer>
    </main>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <dt className="editorial-caption">{label}</dt>
      <dd className="mono-text text-[11px] font-medium uppercase tracking-wider">
        {value}
      </dd>
    </div>
  );
}

function Feature({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="bg-[var(--paper)] p-6 sm:p-7">
      <div className="flex h-8 w-8 items-center justify-center border border-black/25">
        {icon}
      </div>

      <div className="mt-6 flex items-center gap-2">
        <span className="editorial-caption">{number}</span>

        <h3 className="ui-text text-sm font-semibold uppercase tracking-wide">
          {title}
        </h3>
      </div>

      <p className="editorial-serif mt-3 text-sm leading-6 text-[var(--muted)]">
        {text}
      </p>
    </article>
  );
}