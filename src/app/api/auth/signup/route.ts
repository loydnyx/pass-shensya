import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  deriveKeyFromSecret,
  generateSaltHex,
  generateVaultKey,
  generateRecoveryKey,
  wrapKey,
} from "@/lib/crypto";
import { createSession } from "@/lib/session";
import { signupSchema } from "@/lib/validation";
import { normalizeEmail } from "@/lib/format";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }
    const { displayName, password } = parsed.data;
    const email = normalizeEmail(parsed.data.email);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // One random vault key, wrapped two different ways: one unlockable with
    // the master password, one unlockable with a recovery key shown to the
    // user exactly once. Each wrapping is bound to its purpose via AAD
    // ("password" vs "recovery"), so a wrapped copy can't be swapped into
    // the wrong slot even by someone with direct database write access.
    const vaultKey = generateVaultKey();

    const vaultSalt = generateSaltHex();
    const passwordKek = await deriveKeyFromSecret(password, vaultSalt);
    const vaultKeyWrapped = wrapKey(vaultKey, passwordKek, "password");

    const recoveryKey = generateRecoveryKey();
    const recoverySalt = generateSaltHex();
    const recoveryKek = await deriveKeyFromSecret(recoveryKey, recoverySalt);
    const recoveryKeyWrapped = wrapKey(vaultKey, recoveryKek, "recovery");

    let user;
    try {
      user = await prisma.user.create({
        data: {
          displayName,
          email,
          passwordHash,
          vaultSalt,
          vaultKeyWrapped,
          recoverySalt,
          recoveryKeyWrapped,
        },
      });
    } catch (err) {
      // Race condition: two signups with the same email at once. The unique
      // constraint catches it even though we already checked above.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
      }
      throw err;
    }

    await createSession(user.id, vaultKey.toString("hex"));

    return NextResponse.json({
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      recoveryKey, // returned to the client exactly once — never stored in plaintext, never logged
    });
  } catch (err) {
    console.error("signup error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json(
      { error: "The server couldn't complete signup. Please try again." },
      { status: 500 }
    );
  }
}