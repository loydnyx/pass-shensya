"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  Archive,
  BookMarked,
  Check,
  ChevronDown,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Fingerprint,
  Globe,
  KeyRound,
  Lock,
  LogOut,
  Plus,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Stamp,
  Star,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import PasswordStrengthMeter from "./PasswordStrengthMeter";
import SecurityDesk, {
  AUTO_LOCK_OPTIONS,
  AUTO_LOCK_STORAGE_KEY,
  DEFAULT_AUTO_LOCK_MINUTES,
} from "./SecurityDesk";
import {
  analyzeVault,
  type HealthFilter,
  type HealthFlag,
} from "@/lib/passwordHealth";
import { useIdleLock } from "@/lib/useIdleLock";

/* -------------------------------------------------------------------------- */
/* TYPES                                                                      */
/* -------------------------------------------------------------------------- */

type Entry = {
  id: string;
  label: string;
  category: string;
  websiteUrl: string | null;
  favorite: boolean;
  username: string;
  password: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type VaultAppProps = {
  displayName: string;
  email: string;
};

/* -------------------------------------------------------------------------- */
/* CONSTANTS                                                                  */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  "General",
  "Social",
  "Email",
  "Banking",
  "Work",
  "Shopping",
  "Other",
];

const COMMON_SERVICES = [
  "Facebook",
  "Instagram",
  "Twitter/X",
  "TikTok",
  "Snapchat",
  "Gmail",
  "Outlook",
  "Yahoo Mail",
  "iCloud",
  "Microsoft Account",
  "Apple ID",
  "LinkedIn",
  "GitHub",
  "Discord",
  "Telegram",
  "WhatsApp",
  "Messenger",
  "Netflix",
  "Spotify",
  "YouTube",
  "Steam",
  "Epic Games",
  "Amazon",
  "Shopee",
  "Lazada",
  "PayPal",
  "GCash",
  "Maya",
  "BPI Online",
  "BDO Online",
  "Zoom",
  "Slack",
  "Notion",
  "Dropbox",
  "Canva",
  "Adobe",
];

const PASSWORD_CLEAR_MS = 20_000;
const USERNAME_CLEAR_MS = 5_000;

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function generatePassword(length = 20) {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()-_=+[]{};:,.?";
  const all = lowercase + uppercase + numbers + symbols;

  const values = new Uint32Array(length);
  crypto.getRandomValues(values);

  const password = Array.from(values, (value) => all[value % all.length]);

  // Guarantee the main character classes.
  [lowercase, uppercase, numbers, symbols].forEach((characters, index) => {
    const pick = new Uint32Array(1);
    crypto.getRandomValues(pick);

    const position = index % length;
    password[position] = characters[pick[0] % characters.length];
  });

  // Shuffle using crypto randomness.
  for (let i = password.length - 1; i > 0; i--) {
    const pick = new Uint32Array(1);
    crypto.getRandomValues(pick);

    const j = pick[0] % (i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function normalizeWebsite(url: string | null) {
  if (!url) return "";
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function toHref(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/* -------------------------------------------------------------------------- */
/* STYLED SELECT                                                              */
/* -------------------------------------------------------------------------- */

function StyledSelect({
  value,
  onChange,
  children,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="editorial-input w-full appearance-none pr-10"
      >
        {children}
      </select>

      <ChevronDown
        size={15}
        strokeWidth={1.5}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SERVICE NAME FIELD                                                         */
/* -------------------------------------------------------------------------- */

function ServiceNameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const suggestions = COMMON_SERVICES.filter((service) =>
    service.toLowerCase().includes(value.toLowerCase()),
  ).slice(0, 10);

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        className="editorial-input w-full"
        placeholder="Select or enter a service"
        autoComplete="off"
      />

      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-64 overflow-y-auto border border-rule-strong bg-paper-light shadow-[0_16px_35px_rgba(0,0,0,0.14)]">
          <div className="border-b border-rule bg-paper-dark px-3 py-2">
            <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-muted">
              Common services
            </span>
          </div>

          {suggestions.map((service) => (
            <button
              key={service}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(service);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-rule px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-paper-dark"
            >
              <span className="font-serif text-sm">{service}</span>

              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faded">
                Select
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* MAIN APP                                                                   */
/* -------------------------------------------------------------------------- */

export default function VaultApp({ displayName, email }: VaultAppProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [revealedNotes, setRevealedNotes] = useState<Set<string>>(new Set());
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [autoLockMinutes, setAutoLockMinutes] = useState<number>(
    DEFAULT_AUTO_LOCK_MINUTES,
  );
  const [deleteEntryTarget, setDeleteEntryTarget] = useState<Entry | null>(null);

  const clipboardTimer = useRef<number | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/vault", {
        method: "GET",
        cache: "no-store",
      });

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok) {
        throw new Error("Unable to load vault");
      }

      const data = await response.json();

      const vaultEntries = Array.isArray(data)
        ? data
        : Array.isArray(data?.entries)
          ? data.entries
          : [];

      setEntries(vaultEntries);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    return () => {
      if (clipboardTimer.current) {
        window.clearTimeout(clipboardTimer.current);
      }
    };
  }, []);

  // Password health is computed here, in the browser, from entries that are
  // already decrypted in memory. It is never sent anywhere.
  const health = useMemo(() => analyzeVault(entries), [entries]);

  // The auto-lock choice is a harmless preference, so it is kept in this
  // browser. (Vault keys and secrets never go in browser storage.)
  useEffect(() => {
    try {
      const stored = Number(window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY));
      if ((AUTO_LOCK_OPTIONS as readonly number[]).includes(stored)) {
        setAutoLockMinutes(stored);
      }
    } catch {
      // Storage can be unavailable (private mode); the default applies.
    }
  }, []);

  const changeAutoLock = (minutes: number) => {
    setAutoLockMinutes(minutes);

    try {
      window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes));
    } catch {
      // Ignore: the choice still applies for this visit.
    }
  };

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesCategory =
        categoryFilter === "All" || entry.category === categoryFilter;

      if (!matchesCategory) return false;
      if (favoritesOnly && !entry.favorite) return false;
      if (
        healthFilter !== "all" &&
        !health.flags.get(entry.id)?.includes(healthFilter)
      ) {
        return false;
      }
      if (!normalizedQuery) return true;

      return [
        entry.label,
        entry.username,
        entry.websiteUrl ?? "",
        entry.category,
        entry.notes ?? "",
      ].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [entries, query, categoryFilter, favoritesOnly, healthFilter, health]);

  const toggleReveal = (id: string) => {
    setRevealed((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const toggleNotesReveal = (id: string) => {
    setRevealedNotes((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const copyToClipboard = async (
    value: string,
    fieldId: string,
    isPassword = false,
  ) => {
    try {
      await navigator.clipboard.writeText(value);

      setCopiedField(fieldId);

      if (clipboardTimer.current) {
        window.clearTimeout(clipboardTimer.current);
      }

      clipboardTimer.current = window.setTimeout(
        () => setCopiedField(null),
        isPassword ? PASSWORD_CLEAR_MS : USERNAME_CLEAR_MS,
      );
    } catch {
      // Clipboard access may be unavailable in some browsers.
    }
  };

  const toggleFavorite = async (entry: Entry) => {
    const nextFavorite = !entry.favorite;

    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, favorite: nextFavorite } : item,
      ),
    );

    try {
      const response = await fetch(`/api/vault/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite: nextFavorite }),
      });

      if (!response.ok) {
        throw new Error("Favorite update failed");
      }
    } catch {
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? { ...item, favorite: entry.favorite } : item,
        ),
      );
    }
  };

  const deleteEntry = async (entry: Entry) => {
    try {
      const response = await fetch(`/api/vault/${entry.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      setEntries((current) => current.filter((item) => item.id !== entry.id));
      setDeleteEntryTarget(null);
    } catch {
      // Keep the confirmation modal open if deletion fails.
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/";
    }
  };

  // Auto-lock: drop everything decrypted from the page, end the server
  // session (which holds the vault key), and send the user to sign in again.
  const lockVault = useCallback(async () => {
    setEntries([]);
    setRevealed(new Set());
    setRevealedNotes(new Set());
    setFormOpen(false);
    setEditing(null);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login?locked=1";
    }
  }, []);

  // Paused while the Recovery Key modal is open, so the one-time key on
  // screen can't be locked away before it has been saved.
  const { secondsLeft, reset: resetIdle } = useIdleLock({
    timeoutMs: autoLockMinutes * 60_000,
    enabled: !recoveryOpen,
    onLock: lockVault,
  });

  const handleSaved = async () => {
    setFormOpen(false);
    setEditing(null);
    await loadEntries();
  };

  const openNewEntry = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (entry: Entry) => {
    setEditing(entry);
    setFormOpen(true);
  };

  return (
    <main className="min-h-screen bg-paper text-ink ps-page-enter">
      <div className="mx-auto w-full max-w-[1500px] px-5 py-6 sm:px-8 lg:px-10">
        {/* ------------------------------------------------------------- */}
        {/* MASTHEAD                                                      */}
        {/* ------------------------------------------------------------- */}
        <header className="ps-masthead-reveal border-b-4 border-double border-ink pb-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="editorial-kicker">
                  Private digital archive
                </span>

                <span className="hidden h-px w-10 bg-ink sm:block" />

                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
                  Secure edition
                </span>
              </div>

              <div className="editorial-masthead text-5xl sm:text-6xl lg:text-7xl">
                PASS-SHENSYA
              </div>
            </div>

            <div className="flex items-end justify-between gap-8 md:text-right">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink-muted">
                  Archive holder
                </p>

                <p className="mt-1.5 font-serif text-lg leading-none">
                  {displayName}
                </p>

                <p className="mt-1.5 font-mono text-[9px] text-ink-muted">
                  {email}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={logout}
                  className="editorial-button editorial-button-secondary"
                  title="Sign out"
                >
                  <LogOut size={14} />
                  <span className="hidden sm:inline">Sign out</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteAccountOpen(true)}
                  className="editorial-button editorial-button-danger"
                  title="Delete account"
                >
                  <Trash2 size={14} />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------- */}
        {/* ARCHIVE INTRO                                                 */}
        {/* ------------------------------------------------------------- */}
        <section className="ps-masthead-reveal border-b border-rule-strong py-10 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_150px_280px] lg:gap-10">
            <div>
              <div className="mb-6 flex items-center gap-4">
                <span className="archive-label">Private password archive</span>
                <span className="h-px flex-1 bg-rule" />
              </div>

              <h1 className="editorial-display min-w-0 text-[clamp(3rem,7vw,7rem)] leading-[0.84] text-ink">
                <span className="sr-only">YOUR PASSWORDS.</span>

                <span aria-hidden="true">
                  YOUR
                  <br />
                  PASSW
                </span>

                {/* The animated lock seal takes the place of the letter "O" */}
                <span aria-hidden="true" className="ps-o-seal ps-lock-float">
                  <span className="lock-seal-ring ps-lock-ring absolute inset-0 rounded-full" />

                  <span className="ps-lock-core ps-o-seal-core">
                    <Lock strokeWidth={1.4} className="h-[54%] w-[54%] text-ink" />
                  </span>
                </span>

                <span aria-hidden="true">RDS.</span>
              </h1>

              <p className="mt-6 max-w-xl font-serif text-xl italic leading-relaxed text-ink-muted md:text-2xl">
                Your private archive.
              </p>
            </div>

            {/* Archive seal */}
            <div className="hidden flex-col items-center justify-between border-l border-r border-rule px-4 py-2 lg:flex">
              <span className="text-center font-mono text-[8px] uppercase leading-relaxed tracking-[0.18em] text-ink-faded">
                Archive
                <br />
                Vol. 01
              </span>

              <div className="flex flex-col items-center gap-4 text-ink-faded">
                <Stamp size={30} strokeWidth={1} />
                <span className="h-10 w-px bg-rule" />
              </div>

              <span className="text-center font-mono text-[8px] uppercase leading-relaxed tracking-[0.18em] text-ink-faded">
                Private
                <br />
                Edition
              </span>
            </div>

            {/* Status panel */}
            <div className="border-t border-rule-strong pt-6 lg:border-t-0 lg:pt-0">
              <div className="mb-5 flex items-center justify-between gap-3 border-b border-rule pb-3">
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ink-muted">
                  Archive status
                </span>

                <span className="h-2 w-2 rounded-full bg-accent" />
              </div>

              <dl className="space-y-4">
                <div className="flex items-end justify-between gap-4">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faded">
                    Records
                  </dt>

                  <dd className="editorial-display text-4xl leading-none text-ink">
                    {entries.length}
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faded">
                    Status
                  </dt>

                  <dd className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink">
                    Private vault
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-rule pt-4">
                  <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faded">
                    Security
                  </dt>

                  <dd className="font-mono text-[9px] uppercase tracking-[0.14em] text-accent">
                    Protected
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* SECURITY REPORT                                               */}
        {/* ------------------------------------------------------------- */}
        <section className="ps-rule-reveal border-b border-rule-strong py-6">
          <div className="grid gap-0 md:grid-cols-[1fr_2fr]">
            <div className="border-b border-rule pb-5 md:border-b-0 md:border-r md:pb-0 md:pr-8">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} strokeWidth={1.5} />

                <div>
                  <p className="editorial-kicker">Security report</p>

                  <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.15em] text-ink-muted">
                    Archive no. 001
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-5 pt-5 sm:grid-cols-4 md:pl-8 md:pt-0">
              <SecurityItem label="Vault data" value="AES-256-GCM" />
              <SecurityItem label="Vault key" value="256-bit" />
              <SecurityItem label="Password hash" value="bcrypt" />
              <SecurityItem label="Session" value="JWE / A256GCM" />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* SECURITY DESK                                                 */}
        {/* ------------------------------------------------------------- */}
        <SecurityDesk
          health={health}
          loading={loading}
          activeFilter={healthFilter}
          onFilter={setHealthFilter}
          autoLockMinutes={autoLockMinutes}
          onAutoLockChange={changeAutoLock}
          onRegenerateRecovery={() => setRecoveryOpen(true)}
        />

        {/* ------------------------------------------------------------- */}
        {/* TOOLBAR                                                       */}
        {/* ------------------------------------------------------------- */}
        <section className="py-6">
          <div className="flex flex-col gap-3 border-y border-rule-strong py-4 lg:flex-row lg:items-center lg:gap-4">
            <div className="flex shrink-0 items-center gap-3">
              <Archive size={17} strokeWidth={1.5} />

              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em]">
                Vault
              </span>

              <span className="font-mono text-[10px] text-ink-faded">
                / {filteredEntries.length.toString().padStart(2, "0")} records
              </span>
            </div>

            <div className="hidden h-5 w-px shrink-0 bg-rule-strong lg:block" />

            <div className="relative min-w-0 flex-1">
              <Search
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-muted"
              />

              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="editorial-input editorial-input-with-left-icon editorial-input-with-right-icon"
                placeholder="Search your archive..."
                aria-label="Search your archive"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted transition-colors hover:text-ink"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <StyledSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-full shrink-0 lg:w-44"
            >
              <option value="All">All categories</option>

              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </StyledSelect>

            <button
              type="button"
              onClick={() => setFavoritesOnly((value) => !value)}
              aria-pressed={favoritesOnly}
              className={`inline-flex min-h-[42px] shrink-0 items-center justify-center gap-2 border px-4 font-sans text-[0.78rem] font-semibold tracking-[0.04em] transition-colors ${
                favoritesOnly
                  ? "border-accent bg-accent text-paper-light hover:bg-accent-dark"
                  : "border-ink bg-transparent text-ink hover:bg-paper-dark"
              }`}
            >
              <Star
                size={14}
                strokeWidth={1.4}
                fill={favoritesOnly ? "currentColor" : "none"}
              />
              Favorites
            </button>

            <button
              type="button"
              onClick={openNewEntry}
              className="editorial-button editorial-button-primary shrink-0"
            >
              <Plus size={15} />
              New entry
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* ENTRY LIST                                                    */}
        {/* ------------------------------------------------------------- */}
        <section>
          {loading ? (
            <LoadingArchive />
          ) : filteredEntries.length === 0 ? (
            <EmptyArchive
              hasFilters={Boolean(
                query ||
                  categoryFilter !== "All" ||
                  favoritesOnly ||
                  healthFilter !== "all",
              )}
              onClear={() => {
                setQuery("");
                setCategoryFilter("All");
                setFavoritesOnly(false);
                setHealthFilter("all");
              }}
              onCreate={openNewEntry}
            />
          ) : (
            <div className="archive-scroll-area">
              <div className="grid border-l border-t border-rule-strong md:grid-cols-2 xl:grid-cols-3">
                {filteredEntries.map((entry, index) => (
                  <VaultCard
                    key={entry.id}
                    entry={entry}
                    index={index}
                    flags={health.flags.get(entry.id) ?? []}
                    revealed={revealed.has(entry.id)}
                    notesRevealed={revealedNotes.has(entry.id)}
                    copiedField={copiedField}
                    onToggleReveal={() => toggleReveal(entry.id)}
                    onToggleNotesReveal={() => toggleNotesReveal(entry.id)}
                    onCopyUsername={() =>
                      copyToClipboard(
                        entry.username,
                        `${entry.id}:username`,
                      )
                    }
                    onCopyPassword={() =>
                      copyToClipboard(
                        entry.password,
                        `${entry.id}:password`,
                        true,
                      )
                    }
                    onFavorite={() => toggleFavorite(entry)}
                    onEdit={() => openEdit(entry)}
                    onDelete={() => setDeleteEntryTarget(entry)}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ------------------------------------------------------------- */}
        {/* FOOTER                                                        */}
        {/* ------------------------------------------------------------- */}
        <footer className="mt-12 border-t-4 border-double border-ink pt-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-serif text-lg leading-none">PASS-SHENSYA</p>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-ink-muted">
                The private password archive
              </p>
            </div>

            <div className="text-left sm:text-right">
              <p className="font-mono text-[8px] uppercase tracking-[0.16em] text-ink-muted">
                Sensitive vault fields are encrypted
              </p>

              <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.16em] text-ink-faded">
                before database storage
              </p>
            </div>
          </div>
        </footer>
      </div>

      {formOpen && (
        <EntryFormModal
          entry={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {deleteAccountOpen && (
        <DeleteAccountModal onClose={() => setDeleteAccountOpen(false)} />
      )}

      {recoveryOpen && (
        <RecoveryKeyModal onClose={() => setRecoveryOpen(false)} />
      )}

      {secondsLeft !== null && secondsLeft > 0 && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-0 z-[110] border-t-2 border-ink bg-paper-light px-5 py-4 shadow-[0_-12px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="mx-auto flex max-w-[1500px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="editorial-kicker text-accent">
                Locking for your protection
              </p>

              <p className="mt-1.5 font-serif text-sm text-ink-muted">
                No activity detected. Signing you out in{" "}
                <span className="font-mono text-ink">{secondsLeft}s</span>.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetIdle}
                className="editorial-button editorial-button-primary"
              >
                Stay signed in
              </button>

              <button
                type="button"
                onClick={lockVault}
                className="editorial-button editorial-button-secondary"
              >
                Lock now
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteEntryTarget && (
        <DeleteEntryModal
          entry={deleteEntryTarget}
          onClose={() => setDeleteEntryTarget(null)}
          onConfirm={() => deleteEntry(deleteEntryTarget)}
        />
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* SECURITY ITEM                                                              */
/* -------------------------------------------------------------------------- */

function SecurityItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faded">
        {label}
      </p>

      <p className="mt-1.5 font-mono text-[10px] font-medium tracking-[0.05em]">
        {value}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* LOADING                                                                    */
/* -------------------------------------------------------------------------- */

function LoadingArchive() {
  return (
    <div className="border-y border-rule-strong">
      <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <RefreshCw
          size={20}
          strokeWidth={1.2}
          className="mb-5 animate-spin text-ink-muted"
        />

        <p className="editorial-kicker">Opening private archive</p>

        <p className="mt-3 font-serif text-sm italic text-ink-muted">
          Retrieving your vault records...
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* EMPTY ARCHIVE                                                              */
/* -------------------------------------------------------------------------- */

function EmptyArchive({
  hasFilters,
  onClear,
  onCreate,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="border-y border-rule-strong">
      <div className="grid min-h-[360px] items-center gap-10 px-5 py-12 md:grid-cols-[1fr_300px] md:px-8">
        <div>
          <p className="editorial-kicker">
            {hasFilters ? "No matches" : "Archive empty"}
          </p>

          <h2 className="editorial-display mt-4 max-w-2xl text-5xl leading-[0.92] sm:text-6xl">
            {hasFilters ? (
              <>
                NOTHING
                <br />
                FOUND.
              </>
            ) : (
              <>
                BEGIN YOUR
                <br />
                ARCHIVE.
              </>
            )}
          </h2>

          <p className="mt-5 max-w-xl font-serif text-base leading-7 text-ink-muted">
            {hasFilters
              ? "No stored credentials match your current search or category filter."
              : "Your private archive is ready. Add your first credential to begin organizing your accounts."}
          </p>

          <div className="mt-8 flex flex-wrap gap-2">
            {hasFilters && (
              <button
                type="button"
                onClick={onClear}
                className="editorial-button editorial-button-secondary"
              >
                Clear filters
              </button>
            )}

            <button
              type="button"
              onClick={onCreate}
              className="editorial-button editorial-button-primary"
            >
              <Plus size={14} />
              New entry
            </button>
          </div>
        </div>

        <div className="border-t border-rule-strong pt-6 md:border-l md:border-t-0 md:pl-8 md:pt-0">
          <div className="mb-4 flex items-center gap-3">
            <BookMarked size={20} strokeWidth={1.3} />
            <span className="editorial-kicker">Archive note</span>
          </div>

          <p className="font-serif text-sm leading-6 text-ink-muted">
            Store credentials by service, category, username, password, website,
            and private notes.
          </p>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* VAULT CARD                                                                 */
/* -------------------------------------------------------------------------- */

const FLAG_LABELS: Record<HealthFlag, { label: string; title: string }> = {
  weak: { label: "Weak", title: "Short or low-variety password" },
  reused: { label: "Reused", title: "This password is used on more than one entry" },
  old: { label: "Not updated", title: "Not edited in over a year" },
};

function VaultCard({
  entry,
  index,
  flags,
  revealed,
  notesRevealed,
  copiedField,
  onToggleReveal,
  onToggleNotesReveal,
  onCopyUsername,
  onCopyPassword,
  onFavorite,
  onEdit,
  onDelete,
}: {
  entry: Entry;
  index: number;
  flags: HealthFlag[];
  revealed: boolean;
  notesRevealed: boolean;
  copiedField: string | null;
  onToggleReveal: () => void;
  onToggleNotesReveal: () => void;
  onCopyUsername: () => void;
  onCopyPassword: () => void;
  onFavorite: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const number = String(index + 1).padStart(2, "0");

  return (
    <article className="ps-record-enter ps-vault-card flex flex-col border-b border-r border-rule-strong bg-paper-light p-5 transition-colors duration-200 hover:bg-paper-dark sm:p-6"
      style={{ "--ps-delay": `${Math.min(index, 8) * 55}ms` } as CSSProperties}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="pt-1 font-mono text-[9px] text-ink-faded">
            {number}
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="editorial-kicker text-[8px]">
                {entry.category}
              </span>

              {flags.map((flag) => (
                <span
                  key={flag}
                  title={FLAG_LABELS[flag].title}
                  className="border border-accent px-1.5 py-0.5 font-mono text-[8px] uppercase leading-none tracking-[0.12em] text-accent"
                >
                  {FLAG_LABELS[flag].label}
                </span>
              ))}
            </div>

            <h2 className="mt-2.5 truncate font-serif text-2xl leading-tight">
              {entry.label}
            </h2>
          </div>
        </div>

        <button
          type="button"
          onClick={onFavorite}
          className={`ps-icon-action shrink-0 p-1 transition-colors ${
            entry.favorite
              ? "text-accent"
              : "text-ink-faded hover:text-ink"
          }`}
          aria-label={
            entry.favorite ? "Remove from favorites" : "Add to favorites"
          }
        >
          <Star
            size={17}
            strokeWidth={1.4}
            fill={entry.favorite ? "currentColor" : "none"}
          />
        </button>
      </div>

      <div className="my-4 border-t border-rule-strong" />

      {/* Website */}
      {entry.websiteUrl ? (
        <a
          href={toHref(entry.websiteUrl)}
          target="_blank"
          rel="noreferrer"
          className="mb-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-muted transition-colors hover:text-accent"
        >
          <Globe size={12} strokeWidth={1.4} className="shrink-0" />

          <span className="truncate">{normalizeWebsite(entry.websiteUrl)}</span>

          <ExternalLink size={10} strokeWidth={1.4} className="shrink-0" />
        </a>
      ) : (
        <div className="mb-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-faded">
          <Globe size={12} strokeWidth={1.4} className="shrink-0" />
          No website
        </div>
      )}

      {/* Credentials */}
      <div className="space-y-3">
        <CredentialRow
          icon={<UserRound size={13} strokeWidth={1.4} />}
          label="Username"
          value={entry.username}
          copied={copiedField === `${entry.id}:username`}
          onCopy={onCopyUsername}
        />

        <CredentialRow
          icon={<KeyRound size={13} strokeWidth={1.4} />}
          label="Password"
          value={revealed ? entry.password : "••••••••••••••••••"}
          copied={copiedField === `${entry.id}:password`}
          onCopy={onCopyPassword}
          masked={!revealed}
          onReveal={onToggleReveal}
        />
      </div>

      {/* Notes */}
      {entry.notes && (
        <div className="mt-4 border-l-2 border-rule-strong pl-3">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ScrollText size={11} strokeWidth={1.4} />

              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faded">
                Private note
              </span>
            </div>

            <button
              type="button"
              onClick={onToggleNotesReveal}
              className="p-1 text-ink-muted transition-colors hover:text-ink"
              aria-label={
                notesRevealed ? "Hide private note" : "Reveal private note"
              }
            >
              {notesRevealed ? (
                <EyeOff size={12} strokeWidth={1.4} />
              ) : (
                <Eye size={12} strokeWidth={1.4} />
              )}
            </button>
          </div>

          {notesRevealed ? (
            <p className="line-clamp-2 font-serif text-xs leading-5 text-ink-muted">
              {entry.notes}
            </p>
          ) : (
            <p className="font-mono text-xs tracking-[0.2em] text-ink-faded">
              •••••••••••••••••
            </p>
          )}
        </div>
      )}

      {/* Footer — pinned to the bottom so cards in a row line up */}
      <div className="mt-auto pt-5">
        <div className="border-t border-rule pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faded">
                Created
              </p>
              <p
                className="mt-1 font-mono text-[9px] leading-4"
                title={formatDateTime(entry.createdAt)}
              >
                {formatDate(entry.createdAt)}
                <br />
                {formatTime(entry.createdAt)}
              </p>
            </div>

            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em] text-ink-faded">
                Updated
              </p>
              <p
                className="mt-1 font-mono text-[9px] leading-4"
                title={formatDateTime(entry.updatedAt)}
              >
                {formatDate(entry.updatedAt)}
                <br />
                {formatTime(entry.updatedAt)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t border-rule pt-3">
            <div className="flex items-center gap-1">
              <CardAction label="Edit entry" onClick={onEdit}>
                <Edit3 size={13} strokeWidth={1.4} />
              </CardAction>

              <CardAction label="Delete entry" onClick={onDelete} danger>
                <Trash2 size={13} strokeWidth={1.4} />
              </CardAction>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* CREDENTIAL ROW                                                             */
/* -------------------------------------------------------------------------- */

function CredentialRow({
  icon,
  label,
  value,
  copied,
  onCopy,
  masked = false,
  onReveal,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  masked?: boolean;
  onReveal?: () => void;
}) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2">
      <div className="flex items-center gap-1.5">
        {icon}

        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-ink-faded">
          {label}
        </span>
      </div>

      <span
        className={`min-w-0 truncate font-mono text-[11px] ${
          masked ? "tracking-[0.16em]" : ""
        }`}
        title={masked ? undefined : value}
      >
        {value}
      </span>

      <div className="flex items-center gap-0.5">
        {onReveal && (
          <button
            type="button"
            onClick={onReveal}
            className="p-1.5 text-ink-muted transition-colors hover:text-ink"
            aria-label={masked ? "Reveal password" : "Hide password"}
          >
            {masked ? (
              <Eye size={13} strokeWidth={1.4} />
            ) : (
              <EyeOff size={13} strokeWidth={1.4} />
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onCopy}
          className={`ps-icon-action p-1.5 transition-colors ${
            copied
              ? "text-accent"
              : "text-ink-muted hover:text-ink"
          }`}
          aria-label={`Copy ${label.toLowerCase()}`}
        >
          {copied ? (
            <Check size={13} strokeWidth={1.5} />
          ) : (
            <Copy size={13} strokeWidth={1.4} />
          )}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* CARD ACTION                                                                */
/* -------------------------------------------------------------------------- */

function CardAction({
  children,
  label,
  onClick,
  danger = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`ps-icon-action p-1.5 transition-colors ${
        danger
          ? "text-ink-faded hover:text-accent"
          : "text-ink-faded hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* ENTRY FORM MODAL                                                           */
/* -------------------------------------------------------------------------- */

function EntryFormModal({
  entry,
  onClose,
  onSaved,
}: {
  entry: Entry | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [label, setLabel] = useState(entry?.label ?? "");
  const [category, setCategory] = useState(entry?.category ?? "General");
  const [websiteUrl, setWebsiteUrl] = useState(entry?.websiteUrl ?? "");
  const [username, setUsername] = useState(entry?.username ?? "");
  const [password, setPassword] = useState(entry?.password ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isEditing = Boolean(entry);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!label.trim()) {
      setError("Enter a service name.");
      return;
    }

    if (!username.trim()) {
      setError("Enter a username or email.");
      return;
    }

    if (!password) {
      setError("Enter a password.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        entry ? `/api/vault/${entry.id}` : "/api/vault",
        {
          method: entry ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: label.trim(),
            category,
            username: username.trim(),
            password,
            ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save this entry.");
      }

      await onSaved();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save this entry.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={isEditing ? "EDIT ARCHIVE ENTRY" : "NEW ARCHIVE ENTRY"}
      eyebrow={isEditing ? "Revise record" : "Create record"}
      onClose={onClose}
      wide
    >
      <form onSubmit={handleSubmit}>
        <div className="border-y border-rule-strong">
          <div className="grid md:grid-cols-2">
            <div className="space-y-6 border-b border-rule-strong p-5 md:border-b-0 md:border-r md:p-6">
              <div>
                <label className="editorial-label">
                  Service / account name
                </label>

                <ServiceNameField value={label} onChange={setLabel} />
              </div>

              <div>
                <label className="editorial-label">Category</label>

                <StyledSelect value={category} onChange={setCategory}>
                  {CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </StyledSelect>
              </div>

              <div>
                <label className="editorial-label">Website</label>

                <div className="relative">
                  <Globe
                    size={16}
                    className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-ink-muted"
                  />

                  <input
                    value={websiteUrl}
                    onChange={(event) => setWebsiteUrl(event.target.value)}
                    className="editorial-input editorial-input-with-left-icon"
                    placeholder="https://example.com"
                    type="url"
                    autoComplete="url"
                  />
                </div>
              </div>

              <div>
                <label className="editorial-label">Username / email</label>

                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="editorial-input w-full"
                  placeholder="username@example.com"
                  type="text"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-6 p-5 md:p-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="editorial-label mb-0">Password</label>

                  <button
                    type="button"
                    onClick={() => setPassword(generatePassword())}
                    className="editorial-link flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em]"
                  >
                    <RefreshCw size={11} strokeWidth={1.4} />
                    Generate
                  </button>
                </div>

                <div className="relative">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="editorial-input editorial-input-with-right-icon font-mono"
                    placeholder="Enter password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted transition-colors hover:text-ink"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={14} strokeWidth={1.4} />
                    ) : (
                      <Eye size={14} strokeWidth={1.4} />
                    )}
                  </button>
                </div>

                <div className="mt-3">
                  <PasswordStrengthMeter password={password} />
                </div>
              </div>

              <div>
                <label className="editorial-label">Private notes</label>

                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="editorial-input min-h-[150px] w-full resize-y"
                  placeholder="Optional private notes..."
                />
              </div>
            </div>
          </div>
        </div>

        {error && <FormError message={error} />}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="editorial-button editorial-button-secondary"
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="editorial-button editorial-button-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={13} />
                {isEditing ? "Save changes" : "Add to archive"}
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* FORM ERROR                                                                 */
/* -------------------------------------------------------------------------- */

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mt-5 border-l-2 border-accent bg-paper-dark px-4 py-3"
    >
      <p className="font-mono text-[10px] leading-5 text-accent">
        {message}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* DELETE ENTRY MODAL                                                         */
/* -------------------------------------------------------------------------- */

function DeleteEntryModal({
  entry,
  onClose,
  onConfirm,
}: {
  entry: Entry;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);

    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      title="DELETE ARCHIVE ENTRY"
      eyebrow="Remove record"
      onClose={onClose}
    >
      <div className="border-y border-rule-strong">
        <div className="bg-paper-dark p-5 sm:p-6">
          <div className="flex gap-4">
            <Trash2
              size={20}
              strokeWidth={1.4}
              className="mt-0.5 shrink-0 text-accent"
            />

            <div className="min-w-0">
              <p className="editorial-kicker text-accent">
                Confirm removal
              </p>

              <h3 className="mt-2.5 truncate font-serif text-2xl leading-tight">
                {entry.label}
              </h3>

              <p className="mt-3 font-serif text-sm leading-6 text-ink-muted">
                This permanently removes this credential from your private
                archive.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-6 border-y border-rule py-4">
            <div>
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faded">
                Category
              </p>

              <p className="mt-1.5 font-mono text-[10px]">{entry.category}</p>
            </div>

            <div className="min-w-0">
              <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-ink-faded">
                Username
              </p>

              <p className="mt-1.5 truncate font-mono text-[10px]">
                {entry.username}
              </p>
            </div>
          </div>

          <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-muted">
            This action cannot be undone.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="editorial-button editorial-button-secondary"
          disabled={deleting}
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleDelete}
          className="editorial-button editorial-button-danger"
          disabled={deleting}
        >
          {deleting ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              Removing...
            </>
          ) : (
            <>
              <Trash2 size={13} />
              Delete entry
            </>
          )}
        </button>
      </div>
    </ModalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* RECOVERY KEY MODAL                                                         */
/* -------------------------------------------------------------------------- */

function RecoveryKeyModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const [newKey, setNewKey] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();

    if (!password) {
      setError("Enter your master password.");
      return;
    }

    setWorking(true);
    setError("");

    try {
      const response = await fetch("/api/auth/regenerate-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data: { recoveryKey?: string; error?: string } | null =
        await response.json().catch(() => null);

      if (!response.ok || !data?.recoveryKey) {
        throw new Error(
          data?.error || "Unable to generate a new Recovery Key.",
        );
      }

      setNewKey(data.recoveryKey);
      setPassword("");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate a new Recovery Key.",
      );
    } finally {
      setWorking(false);
    }
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // While the new key is on screen and not yet confirmed as saved, the modal
  // cannot be dismissed by accident (Escape, backdrop click, close button):
  // the old key is already invalid and this is the only time the new one is shown.
  const canClose = understood && saved;
  const locked = Boolean(newKey) && !canClose;

  // Also warn before the tab is closed or reloaded while the key is unconfirmed.
  useEffect(() => {
    if (!locked) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [locked]);

  return (
    <ModalShell
      title="RECOVERY KEY"
      eyebrow={newKey ? "New key issued" : "Primary recovery method"}
      onClose={onClose}
      locked={locked}
    >
      {newKey ? (
        <div>
          <div className="border-y border-rule-strong">
            <div
              role="alert"
              className="border-l-4 border-accent bg-paper-dark p-5 sm:p-6"
            >
              <div className="flex items-start gap-4">
                <ShieldAlert
                  size={20}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0 text-accent"
                />

                <div className="min-w-0">
                  <p className="editorial-kicker text-accent">
                    Read this before you continue
                  </p>

                  <p className="mt-3 font-serif text-lg font-semibold leading-snug text-accent-dark">
                    If you lose both your master password and this Recovery
                    Key, your vault cannot be recovered. Not by us, not by
                    email, not by anyone.
                  </p>

                  <ul className="mt-4 space-y-2.5 text-sm leading-6 text-ink">
                    <li className="flex gap-3">
                      <span className="shrink-0 font-mono text-accent">01</span>
                      <span>
                        Shown <strong>only once</strong>. Your previous Recovery
                        Key no longer works.
                      </span>
                    </li>

                    <li className="flex gap-3">
                      <span className="shrink-0 font-mono text-accent">02</span>
                      <span>
                        Your email address alone cannot unlock your vault or
                        reset your password.
                      </span>
                    </li>

                    <li className="flex gap-3">
                      <span className="shrink-0 font-mono text-accent">03</span>
                      <span>
                        Save it <strong>outside Pass-Shensya</strong> — on paper
                        or in another secure place.
                      </span>
                    </li>

                    <li className="flex gap-3">
                      <span className="shrink-0 font-mono text-accent">04</span>
                      <span>
                        Anyone with this key and your email address can open
                        your vault. Never share it.
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="break-all border-y border-rule py-6 text-center">
                <div className="secret-value text-base font-semibold tracking-[0.14em] sm:text-lg">
                  {newKey}
                </div>
              </div>

              <button
                type="button"
                onClick={copyKey}
                className="editorial-button editorial-button-secondary mt-5 w-full"
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied to clipboard
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy recovery key
                  </>
                )}
              </button>
            </div>
          </div>

          <label className="mt-6 flex cursor-pointer items-start gap-3 border border-rule bg-paper p-4">
            <input
              type="checkbox"
              checked={understood}
              onChange={(event) => setUnderstood(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />

            <span className="text-sm leading-6 text-ink">
              I understand that if I lose both my master password and this
              Recovery Key, my vault cannot be recovered.
            </span>
          </label>

          <label className="mt-3 flex cursor-pointer items-start gap-3 border border-rule bg-paper p-4">
            <input
              type="checkbox"
              checked={saved}
              onChange={(event) => setSaved(event.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
            />

            <span className="text-sm leading-6 text-ink">
              I have saved my new Recovery Key somewhere safe, outside
              Pass-Shensya.
            </span>
          </label>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={!canClose}
              className="editorial-button editorial-button-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Check size={13} />
              Done
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleGenerate}>
          <div className="border-y border-rule-strong">
            <div className="bg-paper-dark p-5 sm:p-6">
              <div className="flex gap-4">
                <KeyRound
                  size={19}
                  strokeWidth={1.4}
                  className="mt-0.5 shrink-0 text-accent"
                />

                <div>
                  <p className="editorial-kicker text-accent">
                    Replaces your current key
                  </p>

                  <p className="mt-2.5 font-serif text-base leading-6">
                    Your current Recovery Key stops working as soon as the new
                    one is issued.
                  </p>

                  <p className="mt-2.5 font-serif text-sm leading-6 text-ink-muted">
                    Your vault entries are not changed. Your email address
                    alone cannot unlock your vault.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <label htmlFor="regen-password" className="editorial-label">
                Master password
              </label>

              <div className="relative">
                <input
                  id="regen-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="editorial-input editorial-input-with-right-icon"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted transition-colors hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>

          {error && <FormError message={error} />}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="editorial-button editorial-button-secondary"
              disabled={working}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="editorial-button editorial-button-primary"
              disabled={working}
            >
              {working ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <KeyRound size={13} />
                  Generate new key
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* DELETE ACCOUNT MODAL                                                       */
/* -------------------------------------------------------------------------- */

function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const handleDelete = async (event: FormEvent) => {
    event.preventDefault();

    if (!password) {
      setError("Enter your master password.");
      return;
    }

    if (confirmation !== "DELETE") {
      setError('Type "DELETE" to confirm account deletion.');
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const response = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Unable to delete account.");
      }

      window.location.href = "/";
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete account.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell
      title="DELETE ACCOUNT"
      eyebrow="Permanent action"
      onClose={onClose}
    >
      <form onSubmit={handleDelete}>
        <div className="border-y border-rule-strong">
          <div className="bg-paper-dark p-5 sm:p-6">
            <div className="flex gap-4">
              <Fingerprint
                size={19}
                strokeWidth={1.4}
                className="mt-0.5 shrink-0 text-accent"
              />

              <div>
                <p className="editorial-kicker text-accent">
                  Irreversible
                </p>

                <p className="mt-2.5 font-serif text-base leading-6">
                  This permanently removes your account and stored vault
                  records.
                </p>

                <p className="mt-2.5 font-serif text-sm leading-6 text-ink-muted">
                  Make sure you have anything you need before continuing. This
                  action cannot be undone.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-5 sm:p-6">
            <div>
              <label className="editorial-label">Master password</label>

              <div className="relative">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="editorial-input editorial-input-with-right-icon"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-ink-muted transition-colors hover:text-ink"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            <div>
              <label className="editorial-label">Type DELETE to confirm</label>

              <input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="editorial-input w-full font-mono uppercase"
                placeholder="DELETE"
                autoComplete="off"
              />
            </div>
          </div>
        </div>

        {error && <FormError message={error} />}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="editorial-button editorial-button-secondary"
            disabled={deleting}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="editorial-button editorial-button-danger"
            disabled={deleting}
          >
            {deleting ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 size={13} />
                Delete account
              </>
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

/* -------------------------------------------------------------------------- */
/* MODAL SHELL                                                                */
/* -------------------------------------------------------------------------- */

function ModalShell({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
  locked = false,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** When true, Escape, backdrop click and the close button do nothing. */
  locked?: boolean;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const lockedRef = useRef(locked);

  // Always call the latest onClose without re-running the focus/keydown effect.
  useEffect(() => {
    onCloseRef.current = onClose;
    lockedRef.current = locked;
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!lockedRef.current) onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;

      const modal = modalRef.current;
      if (!modal) return;

      const focusable = modal.querySelectorAll<HTMLElement>(
        'button, input, textarea, select, [href], [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    const focusTimer = window.setTimeout(() => {
      modalRef.current
        ?.querySelector<HTMLElement>("input, textarea, select, button")
        ?.focus();
    }, 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      window.clearTimeout(focusTimer);
    };
  }, []);

  return (
    <div
      className="ps-modal-backdrop fixed inset-0 z-[100] flex items-end justify-center bg-[rgba(23,23,23,0.72)] backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (!locked && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="archive-modal-title"
        className={`ps-modal-panel max-h-[94vh] w-full overflow-y-auto border border-rule-strong bg-paper-light p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:p-6 ${
          wide ? "max-w-4xl" : "max-w-xl"
        }`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-5 border-b-4 border-double border-ink pb-4">
          <div>
            <p className="editorial-kicker">{eyebrow}</p>

            <h2
              id="archive-modal-title"
              className="editorial-serif mt-1.5 text-3xl leading-none sm:text-4xl"
            >
              {title}
            </h2>
          </div>

          {!locked && (
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-1 text-ink-muted transition-colors hover:text-ink"
              aria-label="Close dialog"
            >
              <X size={19} strokeWidth={1.4} />
            </button>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}