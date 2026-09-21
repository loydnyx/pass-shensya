import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  deriveKeyFromSecret,
  generateRecoveryKey,
  generateSaltHex,
  unwrapKey,
  wrapKey,
} from "@/lib/crypto";
import { getSession } from "@/lib/session";
import { checkRateLimit, rateLimitMessage, resetRateLimit } from "@/lib/rateLimit";

const regenerateSchema = z.object({
  password: z.string().min(1, "Enter your master password to confirm"),
});

/**
 * Replaces the user's Recovery Key while they are signed in.
 *
 * - Requires the master password again (a stolen session cookie alone is not
 *   enough to replace the recovery key).
 * - The vault key is recovered by unwrapping it with the master password, so
 *   it never has to be trusted from the session cookie.
 * - The SAME vault key is re-wrapped under a brand-new recovery key + salt.
 *   No vault entry is touched or re-encrypted.
 * - The old wrapped copy is overwritten, so the old Recovery Key stops
 *   working immediately.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = regenerateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter your master password to confirm" }, { status: 400 });
    }
    const { password } = parsed.data;

    // Keyed by user (not IP): this route is a password oracle for anyone who
    // holds a valid session cookie, wherever they are connecting from.
    const limitKey = `regen-recovery:${session.userId}`;
    const limit = await checkRateLimit(limitKey);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: rateLimitMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    let vaultKey: Buffer;
    try {
      const passwordKek = await deriveKeyFromSecret(password, user.vaultSalt);
      vaultKey = unwrapKey(user.vaultKeyWrapped, passwordKek, "password");
    } catch {
      // Password hash matched but the wrapped key didn't open — inconsistent
      // state. Fail closed instead of issuing a key for a vault we can't open.
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const recoveryKey = generateRecoveryKey();
    const recoverySalt = generateSaltHex();
    const recoveryKek = await deriveKeyFromSecret(recoveryKey, recoverySalt);
    const recoveryKeyWrapped = wrapKey(vaultKey, recoveryKek, "recovery");

    await prisma.user.update({
      where: { id: user.id },
      data: { recoverySalt, recoveryKeyWrapped },
    });

    await resetRateLimit(limitKey);

    // Returned exactly once, never stored in plaintext, never logged.
    return NextResponse.json({ recoveryKey }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("regenerate-recovery error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "Couldn't generate a new Recovery Key right now." },
      { status: 500 }
    );
  }
}