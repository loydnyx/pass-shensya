"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowRight, Check, Copy, ShieldAlert } from "lucide-react";

type RecoveryKeyPanelProps = {
  recoveryKey: string;
  kicker: string;
  title: string;
  intro: string;
  /** True when this key replaces one that was just used (after recovery). */
  replacesPrevious?: boolean;
  onContinue: () => void;
};

/**
 * The one-time Recovery Key screen, shared by signup and account recovery:
 * strong warning, the key, a copy button, two confirmations, and a leave-page
 * guard until both are checked. Render it inside <AuthShell narrow locked>.
 */
export default function RecoveryKeyPanel({
  recoveryKey,
  kicker,
  title,
  intro,
  replacesPrevious = false,
  onContinue,
}: RecoveryKeyPanelProps) {
  const [understood, setUnderstood] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const canContinue = understood && saved;

  // This key is shown only once: warn before the tab is closed or reloaded
  // until it has been acknowledged.
  useEffect(() => {
    if (canContinue) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [canContinue]);

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="text-center">
        <div className="editorial-kicker text-[var(--accent)]">{kicker}</div>

        <h1 className="editorial-display mt-5 text-[clamp(3.5rem,8vw,7rem)] leading-[0.9]">
          {title}
        </h1>

        <p className="editorial-serif mx-auto mt-6 max-w-xl text-lg leading-7 text-[var(--muted)]">
          {intro}
        </p>
      </div>

      <div
        role="alert"
        className="mt-8 border-l-4 border-[var(--accent)] bg-[rgba(118,31,37,0.06)] px-5 py-5 sm:px-7 sm:py-6"
      >
        <div className="flex items-start gap-4">
          <ShieldAlert
            className="mt-0.5 shrink-0 text-[var(--accent)]"
            size={22}
            strokeWidth={1.5}
          />

          <div className="min-w-0">
            <div className="editorial-kicker text-[var(--accent)]">
              Read this before you continue
            </div>

            <p className="editorial-serif mt-3 text-xl font-semibold leading-snug text-[var(--accent-dark)] sm:text-2xl">
              If you lose both your master password and this Recovery Key, your
              vault cannot be recovered. Not by us, not by email, not by anyone.
            </p>

            <ul className="mt-5 space-y-3 text-sm leading-6 text-[var(--ink)]">
              <WarningItem number="01">
                {replacesPrevious ? (
                  <>
                    The Recovery Key you just used <strong>no longer works</strong>.
                    This new key replaces it, and is shown{" "}
                    <strong>only once</strong>.
                  </>
                ) : (
                  <>
                    This key is shown <strong>only once</strong>. When you leave
                    this page, it cannot be shown again.
                  </>
                )}
              </WarningItem>

              <WarningItem number="02">
                Your email address alone cannot unlock your vault or reset your
                password. We cannot recover your data for you.
              </WarningItem>

              <WarningItem number="03">
                Save it <strong>outside Pass-Shensya</strong> — on paper or in
                another secure place. Do not keep it only inside this vault.
              </WarningItem>

              <WarningItem number="04">
                Anyone who has this key and your email address can open your
                vault. Never share it.
              </WarningItem>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-10 border-y-2 border-black/70 bg-[var(--paper-light)] px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <span className="editorial-kicker">Recovery Key</span>

          <span className="classified-stamp">Confidential</span>
        </div>

        <div className="my-8 break-all border-y border-black/20 py-7 text-center">
          <div className="secret-value text-lg font-semibold tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]">
            {recoveryKey}
          </div>
        </div>

        <button
          type="button"
          onClick={copyKey}
          className="editorial-button editorial-button-secondary w-full"
        >
          {copied ? (
            <>
              <Check size={15} />
              Copied to clipboard
            </>
          ) : (
            <>
              <Copy size={15} />
              Copy recovery key
            </>
          )}
        </button>
      </div>

      <label className="mt-7 flex cursor-pointer items-start gap-3 border border-black/15 bg-black/[0.02] p-4">
        <input
          type="checkbox"
          checked={understood}
          onChange={(event) => setUnderstood(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />

        <span className="text-sm leading-6 text-[var(--ink)]">
          I understand that if I lose both my master password and this Recovery
          Key, my vault cannot be recovered.
        </span>
      </label>

      <label className="mt-3 flex cursor-pointer items-start gap-3 border border-black/15 bg-black/[0.02] p-4">
        <input
          type="checkbox"
          checked={saved}
          onChange={(event) => setSaved(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
        />

        <span className="text-sm leading-6 text-[var(--ink)]">
          I have saved my Recovery Key somewhere safe, outside Pass-Shensya.
        </span>
      </label>

      <button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        className="editorial-button editorial-button-primary mt-4 w-full disabled:cursor-not-allowed disabled:opacity-40"
      >
        Continue to my vault
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

function WarningItem({
  number,
  children,
}: {
  number: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mono-text shrink-0 text-[var(--accent)]">{number}</span>
      <span>{children}</span>
    </li>
  );
}