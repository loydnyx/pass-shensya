import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "pass-shensya-session";
const SESSION_TTL_SECONDS = 60 * 60 * 2; // 2 hours
const REFRESH_THRESHOLD_SECONDS = 60 * 15; // only slide the cookie if >15 min has passed since it was last issued

function getSessionSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Generate one with: openssl rand -hex 32");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(secret)) {
    throw new Error(
      "SESSION_SECRET must be exactly 64 hexadecimal characters (32 bytes). Generate one with: openssl rand -hex 32"
    );
  }
  return new Uint8Array(Buffer.from(secret, "hex"));
}

async function issueSessionToken(userId: string, vaultKeyHex: string): Promise<string> {
  return new EncryptJWT({ userId, vaultKeyHex })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .encrypt(getSessionSecretKey());
}

function setCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

/**
 * The session cookie carries the userId and the derived vault key (hex),
 * encrypted with a server-side secret (JWE, A256GCM). This lets the app
 * decrypt vault entries on each request without re-asking the master
 * password every time, while keeping the key unreadable to anyone but this
 * server even if they can read the cookie value. It never touches the
 * database, localStorage, or sessionStorage.
 */
export async function createSession(userId: string, vaultKeyHex: string) {
  const token = await issueSessionToken(userId, vaultKeyHex);
  setCookie(token);
}

export type SessionPayload = { userId: string; vaultKeyHex: string; issuedAt: number };

/** Decodes and validates the session cookie. Never trusts the JWT payload's shape blindly. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtDecrypt(token, getSessionSecretKey());

    const userId = payload.userId;
    if (typeof userId !== "string" || userId.length === 0) return null;

    const vaultKeyHex = payload.vaultKeyHex;
    if (typeof vaultKeyHex !== "string" || !/^[0-9a-fA-F]{64}$/.test(vaultKeyHex)) return null;

    const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
    return { userId, vaultKeyHex, issuedAt };
  } catch {
    return null;
  }
}

/**
 * Slides the session's expiration forward — a real idle timeout, not just a
 * fixed one — but only re-issues the cookie once a meaningful chunk of the
 * TTL has elapsed, to avoid writing a Set-Cookie header on every request.
 * Next.js only allows cookie writes from Route Handlers / Server Actions,
 * so this is called from the vault API routes (which run on nearly every
 * interaction), not from Server Component pages like the dashboard.
 */
export async function touchSession(session: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  if (now - session.issuedAt < REFRESH_THRESHOLD_SECONDS) return;
  const token = await issueSessionToken(session.userId, session.vaultKeyHex);
  setCookie(token);
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}