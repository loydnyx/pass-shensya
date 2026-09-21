import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { VaultEntry } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession, touchSession } from "@/lib/session";
import { decryptField, encryptField, buildVaultFieldAad } from "@/lib/crypto";
import { vaultEntrySchema } from "@/lib/validation";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await touchSession(session);

    const key = Buffer.from(session.vaultKeyHex, "hex");
    const entries = await prisma.vaultEntry.findMany({
      // Never trust a client-supplied userId anywhere — this always comes
      // from the authenticated session.
      where: { userId: session.userId },
      orderBy: [{ favorite: "desc" }, { label: "asc" }],
    });

    const decrypted = entries.map((e: VaultEntry) => ({
      id: e.id,
      label: e.label,
      category: e.category,
      websiteUrl: e.websiteUrl,
      favorite: e.favorite,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
      username: decryptField(e.usernameCipher, key, buildVaultFieldAad(session.userId, e.id, "username")),
      password: decryptField(e.passwordCipher, key, buildVaultFieldAad(session.userId, e.id, "password")),
      notes: e.notesCipher ? decryptField(e.notesCipher, key, buildVaultFieldAad(session.userId, e.id, "notes")) : "",
    }));

    return NextResponse.json(decrypted);
  } catch (err) {
    console.error("vault GET error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't load your vault right now." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await touchSession(session);

    const body = await req.json().catch(() => null);
    const parsed = vaultEntrySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid entry" }, { status: 400 });
    }
    const { label, category, websiteUrl, username, password, notes, favorite } = parsed.data;
    const key = Buffer.from(session.vaultKeyHex, "hex");

    // Generated up front (instead of left to Prisma's default) so the ID
    // exists before encryption and can be bound into each field's AAD.
    const entryId = randomUUID();

    const entry = await prisma.vaultEntry.create({
      data: {
        id: entryId,
        userId: session.userId,
        label,
        category,
        websiteUrl: websiteUrl || null,
        usernameCipher: encryptField(username, key, buildVaultFieldAad(session.userId, entryId, "username")),
        passwordCipher: encryptField(password, key, buildVaultFieldAad(session.userId, entryId, "password")),
        notesCipher: notes ? encryptField(notes, key, buildVaultFieldAad(session.userId, entryId, "notes")) : null,
        favorite: !!favorite,
      },
    });

    return NextResponse.json({ id: entry.id });
  } catch (err) {
    console.error("vault POST error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't save this entry right now." }, { status: 500 });
  }
}