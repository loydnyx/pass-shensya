import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { deriveKeyFromSecret, unwrapKey } from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { loginSchema } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage, resetRateLimit } from "@/lib/rateLimit";
import { normalizeEmail } from "@/lib/format";
import { getClientIp } from "@/lib/clientIp";

// A fixed, valid-format bcrypt hash of an unrelated random value. Compared
// against when no account exists, so the "no such account" path takes
// roughly the same time as the "wrong password" path instead of returning
// early — a simple, non-exhaustive mitigation against account enumeration
// via response timing.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8vLZapaWvVvTL9O5J1s7NcS.4y9j9O";

// Two buckets per attempt:
//  - per client + account: the tight limit (8 / 10 min, the default).
//  - per account only: a looser backstop that still applies when an attacker
//    rotates or spoofs IP addresses. The trade-off is that someone can hold a
//    victim's sign-in in "try again later" for up to one window by failing
//    this many times; that is preferred over unlimited guessing.
const ACCOUNT_MAX_ATTEMPTS = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password" }, { status: 400 });
    }
    const email = normalizeEmail(parsed.data.email);
    const { password } = parsed.data;

    const ip = getClientIp(req);
    const clientKey = `login:${ip}:${email}`;
    const accountKey = `login-account:${email}`;

    const [clientLimit, accountLimit] = await Promise.all([
      checkRateLimit(clientKey),
      checkRateLimit(accountKey, { max: ACCOUNT_MAX_ATTEMPTS }),
    ]);
    if (!clientLimit.allowed || !accountLimit.allowed) {
      const retryAfterSeconds = Math.max(
        clientLimit.retryAfterSeconds ?? 0,
        accountLimit.retryAfterSeconds ?? 0,
      );
      return NextResponse.json(
        { error: rateLimitMessage(retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // Same generic error whether the email doesn't exist or the password is
    // wrong — never reveal which one, so attackers can't enumerate accounts.
    const genericError = NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { email } });
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) return genericError;

    await Promise.all([resetRateLimit(clientKey), resetRateLimit(accountKey)]);

    const passwordKek = await deriveKeyFromSecret(password, user.vaultSalt);
    let vaultKey;
    try {
      vaultKey = unwrapKey(user.vaultKeyWrapped, passwordKek, "password");
    } catch {
      // Password matched but unwrap failed — shouldn't happen, but fail
      // closed rather than trusting an inconsistent state.
      return genericError;
    }

    await createSession(user.id, vaultKey.toString("hex"));

    return NextResponse.json({ id: user.id, displayName: user.displayName, email: user.email });
  } catch (err) {
    console.error("login error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "The server couldn't complete sign in. Please try again." },
      { status: 500 }
    );
  }
}