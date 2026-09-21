/**
 * Stand-in for src/lib/session.ts. The real one reads and writes a cookie via
 * next/headers, which only exists inside a request; here the "cookie" is just
 * a variable, so routes that call createSession() leave the caller signed in.
 */
export type SessionPayload = { userId: string; vaultKeyHex: string; issuedAt: number };

export const sessionState: {
  current: SessionPayload | null;
  created: { userId: string; vaultKeyHex: string }[];
  cleared: number;
} = { current: null, created: [], cleared: 0 };

export function resetSession() {
  sessionState.current = null;
  sessionState.created = [];
  sessionState.cleared = 0;
}

export function signInAs(userId: string, vaultKeyHex: string) {
  sessionState.current = { userId, vaultKeyHex, issuedAt: Math.floor(Date.now() / 1000) };
}

export async function getSession() {
  return sessionState.current;
}

export async function createSession(userId: string, vaultKeyHex: string) {
  sessionState.created.push({ userId, vaultKeyHex });
  signInAs(userId, vaultKeyHex);
}

export async function touchSession() {
  // The real one slides the cookie's expiry; nothing to do here.
}

export function clearSession() {
  sessionState.cleared += 1;
  sessionState.current = null;
}