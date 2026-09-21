import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, clearSession } from "@/lib/session";
import { checkRateLimit, rateLimitMessage } from "@/lib/rateLimit";

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Enter your master password to confirm"),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const body = await req.json().catch(() => null);
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter your master password to confirm" }, { status: 400 });
    }

    // Keyed by user, not IP: this route checks the master password, so anyone
    // holding a valid session cookie could otherwise use it to guess it.
    const limit = await checkRateLimit(`delete-account:${session.userId}`);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: rateLimitMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds ?? 60) } }
      );
    }

    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // VaultEntry rows cascade-delete automatically (onDelete: Cascade in schema).
    await prisma.user.delete({ where: { id: user.id } });
    clearSession();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("delete-account error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't delete the account right now." }, { status: 500 });
  }
}