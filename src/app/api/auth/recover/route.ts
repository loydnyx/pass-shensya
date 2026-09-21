import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  deriveKeyFromSecret,
  generateRecoveryKey,
  generateSaltHex,
  unwrapKey,
  wrapKey,
} from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { recoverySchema } from "@/lib/validation";
import { checkRateLimit, rateLimitMessage, resetRateLimit } from "@/lib/rateLimit";
import { normalizeEmail, normalizeRecoveryKey } from "@/lib/format";
import { getClientIp } from "@/lib/clientIp";

// Same two-bucket scheme as login (see login/route.ts). Recovery keys carry
// 128 bits of entropy, so guessing is not realistic; the account-level cap
// exists to keep this endpoint from being used as a free hashing/scrypt load.
const ACCOUNT_MAX_ATTEMPTS = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = recoverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const email = normalizeEmail(parsed.data.email);
    const { newPassword } = parsed.data;

    // Recovery attempts are effectively a second password — throttle at
    // least as hard as login, on their own separate buckets.
    const ip = getClientIp(req);
    const clientKey = `recover:${ip}:${email}`;
    const accountKey = `recover-account:${email}`;

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

    const genericError = NextResponse.json(
      { error: "That email and recovery key don't match our records." },
      { status: 400 }
    );

    // normalizeRecoveryKey never throws on malformed input — it returns
    // null, which we treat the same as "wrong key" rather than a crash.
    const normalizedKey = normalizeRecoveryKey(parsed.data.recoveryKey);
    if (!normalizedKey) return genericError;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return genericError;

    let vaultKey;
    try {
      const recoveryKek = await deriveKeyFromSecret(normalizedKey, user.recoverySalt);
      vaultKey = unwrapKey(user.recoveryKeyWrapped, recoveryKek, "recovery");
    } catch {
      // Wrong recovery key — AES-GCM's tag check fails and throws. Expected, not a bug.
      return genericError;
    }

    // Recovery key checks out. Two things change, in ONE database update so
    // they can't get out of step:
    //  1. The SAME vault key is re-wrapped under the new master password.
    //  2. The Recovery Key is rotated: the key that was just used is
    //     replaced by a brand-new one (new salt, same vault key), so a
    //     recovery key that has been used, leaked or shown once is never
    //     valid again. No vault entry is re-encrypted; they are encrypted
    //     with the vault key itself, which never changes.
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    const newVaultSalt = generateSaltHex();
    const newPasswordKek = await deriveKeyFromSecret(newPassword, newVaultSalt);
    const newVaultKeyWrapped = wrapKey(vaultKey, newPasswordKek, "password");

    const newRecoveryKey = generateRecoveryKey();
    const newRecoverySalt = generateSaltHex();
    const newRecoveryKek = await deriveKeyFromSecret(newRecoveryKey, newRecoverySalt);
    const newRecoveryKeyWrapped = wrapKey(vaultKey, newRecoveryKek, "recovery");

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        vaultSalt: newVaultSalt,
        vaultKeyWrapped: newVaultKeyWrapped,
        recoverySalt: newRecoverySalt,
        recoveryKeyWrapped: newRecoveryKeyWrapped,
      },
    });

    await Promise.all([resetRateLimit(clientKey), resetRateLimit(accountKey)]);
    await createSession(user.id, vaultKey.toString("hex"));

    // The new recovery key is returned exactly once — never stored in
    // plaintext, never logged.
    return NextResponse.json(
      {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        recoveryKey: newRecoveryKey,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("recover error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "The server couldn't complete recovery right now." },
      { status: 500 }
    );
  }
}