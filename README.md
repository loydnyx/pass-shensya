# Pass-Shensya

A private password vault with a newsprint-styled interface. Each person who
signs up gets their own isolated vault of credentials (service, URL, username,
password, notes). The sensitive fields are encrypted before they are written to
the database, so a copy of the database on its own is ciphertext, not logins.

> **Status:** a personal project. It has not had an independent security audit.
> Read [What this does and does not protect](#what-this-does-and-does-not-protect)
> before storing anything important in it.

## Features

- Encrypted vault entries with search, categories, favorites, copy and reveal
- Built-in password generator and strength meter
- **Password health:** flags weak, reused and long-untouched passwords (computed
  in the browser, nothing is sent anywhere)
- **Auto-lock:** signs you out after 5, 10, 15 or 30 minutes of inactivity, with
  a 30-second warning
- **Recovery Key:** the primary recovery method, rotated after every recovery,
  and replaceable from the dashboard
- Rate limiting on sign-in, recovery, recovery-key regeneration and account
  deletion
- Content-Security-Policy with a per-request nonce, HSTS and other security headers

## Stack

Next.js 14 (App Router) · TypeScript · Prisma · PostgreSQL (Supabase) ·
Tailwind CSS · lucide-react · `jose` (session JWE) · `bcryptjs` · `zod`.
Optional: Upstash Redis for rate limiting.

## Getting started

Requires Node.js 18.17 or newer and a PostgreSQL database (a free Supabase
project works).

```bash
npm install
cp .env.example .env     # then fill it in (see below)
npm run db:push          # creates the tables from prisma/schema.prisma
npm run dev              # http://localhost:3000
```

Generate the session secret (exactly 64 hex characters):

```bash
openssl rand -hex 32
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Pooled Postgres connection (port 6543, add `?pgbouncer=true&connection_limit=1`). Used at runtime. |
| `DIRECT_URL` | yes | Direct Postgres connection (port 5432). Used only by `prisma db push` and migrations. |
| `SESSION_SECRET` | yes | 64 hex characters. Encrypts the session cookie. Use a different value per environment. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | recommended in production | Shared rate-limit counters. `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel's Upstash integration) also work. Without them, limits are kept per server instance only. |
| `NEXT_PUBLIC_SITE_URL` | recommended in production | Public URL with scheme, e.g. `https://example.com`. Used for the sitemap, `robots.txt` and social metadata. |

Never commit `.env`. It is already in `.gitignore`.

## Deploying (GitHub → Vercel)

1. Push the repository to GitHub.
2. In Vercel, import the repository. The default Next.js settings work;
   `postinstall` runs `prisma generate`.
3. Add the environment variables above in **Project Settings → Environment
   Variables**. Use a fresh `SESSION_SECRET` for production.
4. Set **Project Settings → Functions → Function Region** close to your database
   (and your Upstash Redis region). Matching regions keeps sign-in fast.
5. Create the tables once: run `npm run db:push` from your machine with
   `DIRECT_URL` pointing at the production database. (`db push` is fine for a
   first deploy; once real users exist, switch to `prisma migrate` so schema
   changes are versioned.)
6. Deploy, then check: sign up, sign out, sign in, recover with the Recovery Key,
   and look at the response headers of `/` in the browser dev tools
   (`Content-Security-Policy`, `Strict-Transport-Security`).

## How the security works

- **Master password.** Checked at sign-in with `bcrypt` (cost 12). It is never
  stored.
- **Vault key.** Each account has a random 256-bit vault key, generated once at
  signup. It is never derived from a password and never stored in the clear.
- **Two wrapped copies.** The vault key is kept only as two AES-256-GCM
  "wrapped" copies: one unlockable with a key derived (scrypt, N=32768) from the
  master password, one from the Recovery Key.
- **Vault fields.** Usernames, passwords and notes are encrypted with
  AES-256-GCM using the vault key, a fresh random IV per value, and additional
  authenticated data that binds each value to its user, entry and field.
- **Session.** After sign-in the vault key is carried in an encrypted (JWE,
  A256GCM), `httpOnly`, `SameSite=Lax` cookie (`Secure` in production) that
  lasts two hours and slides while you use the app. The server uses it to
  decrypt entries for you on each request.
- **Recovery Key.** A 128-bit random key shown once. Using it to recover sets a
  new master password and **replaces the Recovery Key**, so a used or exposed
  key stops working. You can also replace it any time from the dashboard's
  Security desk (it asks for your master password).
- **Rate limiting.** Sign-in and recovery are limited per client and per
  account; recovery-key regeneration and account deletion are limited per user.
  Counters live in Redis when configured; keys are hashed so emails and IP
  addresses are not stored there. If Redis is unreachable it falls back to
  per-instance limits instead of failing open or locking everyone out.
- **Headers.** Content-Security-Policy (per-request nonce, no `unsafe-inline`
  for scripts), HSTS in production, `X-Frame-Options`, `nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, and `no-store` on `/api` and
  `/dashboard`.

### What this does and does not protect

**It does protect against:** someone who obtains a copy of the database. They
get ciphertext and wrapped keys, and would have to guess a strong master
password or Recovery Key against scrypt.

**It does not make this "zero-knowledge".** The server decrypts your vault while
you are signed in, because the vault key is in your session cookie. Anyone who
controls the running server, or who has both the database and `SESSION_SECRET`
plus a valid cookie, could read a signed-in vault. Labels, categories and website
URLs are stored in plain text so they can be searched.

**Recovery limits.** If you lose **both** your master password and your Recovery
Key, the vault cannot be recovered by anyone, including the operator. Your email
address alone cannot unlock it, and there is no email-based recovery.

**Not implemented:** multi-factor authentication, email verification, server-side
session revocation (a stolen cookie works until it expires or you lock), an audit
log, and an independent security review.

## Project structure

```
prisma/schema.prisma          User + VaultEntry models
src/middleware.ts             Content-Security-Policy with a per-request nonce
src/lib/crypto.ts             scrypt key derivation, AES-256-GCM, key wrapping
src/lib/session.ts            Encrypted session cookie (JWE)
src/lib/rateLimit.ts          Redis-backed limiter with in-memory fallback
src/lib/passwordStrength.ts   Strength heuristic
src/lib/passwordHealth.ts     Weak / reused / old detection (client-side)
src/lib/useIdleLock.ts        Auto-lock hook
src/app/api/auth/*            signup, login, logout, recover, regenerate-recovery,
                              delete-account, and the current-user route
src/app/api/vault/*           Vault CRUD
src/app/page.tsx              Front page
src/app/{login,signup,recover}/page.tsx
src/app/dashboard/page.tsx    Auth-gated vault
src/components/VaultApp.tsx   The vault UI
src/components/SecurityDesk.tsx      Password health, auto-lock, Recovery Key
src/components/RecoveryKeyPanel.tsx  One-time Recovery Key screen
src/components/AuthShell.tsx  Shared frame for the auth pages
tests/                        Vitest suite (helpers/ holds the fake Prisma + session)
.github/workflows/ci.yml      Type-check, test and build on push / PR
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / server |
| `npm run db:push` | Sync `prisma/schema.prisma` to the database |
| `npm run db:studio` | Open Prisma Studio |
| `npm test` | Run the automated tests once |
| `npm run test:watch` | Re-run tests as you edit |
| `npm run typecheck` | Type-check the whole project, tests included |

## Testing

`npm test` runs the test suite with [Vitest](https://vitest.dev). It needs no
database, no Redis and no network.

What is covered:

- **Crypto:** AES-GCM round trips, tamper and wrong-key detection, that
  ciphertext is bound to its user, entry and field, key wrapping purposes, and
  Recovery Key formatting.
- **Auth routes** (signup, login, recover, regenerate-recovery, delete-account):
  generic error messages, rate limits (including IP rotation), that a Recovery
  Key works exactly once, and that the vault key never changes.
- **Vault routes:** secrets are stored as ciphertext, ownership checks,
  `createdAt` is never writable, `updatedAt` moves on edit.
- **A whole account lifetime:** sign up, store an entry, sign in, recover,
  regenerate the key, and check the entry still decrypts each time.
- **Rate limiter:** against a fake Upstash server, including expiry, hashed
  keys, and the fallback when Redis is down or hung.
- **CSP middleware** and the **password-health** logic.

What is *not* covered: the route tests use an in-memory stand-in for Prisma and
for the cookie session (see `tests/helpers/`), so they do not exercise Postgres,
Prisma itself, real cookies or the browser UI. Run the smoke test in
[Deploying](#deploying-github--vercel) against a real environment.

`.github/workflows/ci.yml` runs type-check, tests and a build on every push to
`main` and on pull requests.

> **zod note.** The vault `PUT` route uses `vaultEntrySchema.partial()`. Under
> zod 3 that leaves omitted fields alone; zod 4 applies `.default()` values
> inside optional fields, which would make a favorite-only update blank the
> username and reset the category. The test "toggling favorite touches nothing
> else" fails if an upgrade changes this.

## Known follow-ups

- Upgrade Next.js (the installed 14.2.x prints an "outdated" notice) and run
  `npm audit`.
- Multi-factor authentication and server-side session revocation.