import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, touchSession } from "@/lib/session";
import { encryptField, buildVaultFieldAad } from "@/lib/crypto";
import { vaultEntrySchema } from "@/lib/validation";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await touchSession(session);

    const body = await req.json().catch(() => null);
    const parsed = vaultEntrySchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid entry" }, { status: 400 });
    }
    const { label, category, websiteUrl, username, password, notes, favorite } = parsed.data;
    const key = Buffer.from(session.vaultKeyHex, "hex");
    const entryId = params.id;

    const result = await prisma.vaultEntry.updateMany({
      // Combined where — the URL's id alone is never trusted; the row must
      // also belong to the authenticated session's user, or nothing updates.
      // (updateMany + checking `count` avoids a separate ownership fetch.)
      where: { id: entryId, userId: session.userId },
      data: {
        ...(label !== undefined && { label }),
        ...(category !== undefined && { category }),
        ...(websiteUrl !== undefined && { websiteUrl: websiteUrl || null }),
        ...(username !== undefined && {
          usernameCipher: encryptField(username, key, buildVaultFieldAad(session.userId, entryId, "username")),
        }),
        ...(password !== undefined && {
          passwordCipher: encryptField(password, key, buildVaultFieldAad(session.userId, entryId, "password")),
        }),
        ...(notes !== undefined && {
          notesCipher: notes ? encryptField(notes, key, buildVaultFieldAad(session.userId, entryId, "notes")) : null,
        }),
        ...(favorite !== undefined && { favorite }),
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("vault PUT error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't update this entry right now." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    await touchSession(session);

    const result = await prisma.vaultEntry.deleteMany({
      where: { id: params.id, userId: session.userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("vault DELETE error:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't delete this entry right now." }, { status: 500 });
  }
}