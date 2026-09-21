import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { generateVaultKey } from "@/lib/crypto";
import { call } from "./helpers/http";
import { entries, prisma, resetDb } from "./helpers/fakeDb";
import { resetSession, signInAs } from "./helpers/fakeSession";

vi.mock("@/lib/db", () => import("./helpers/fakeDb"));
vi.mock("@/lib/session", () => import("./helpers/fakeSession"));

import { GET, POST } from "@/app/api/vault/route";
import { DELETE, PUT } from "@/app/api/vault/[id]/route";

const ME = "user-me";
const OTHER = "user-other";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const list = () => call(GET, "/api/vault", undefined, { method: "GET" });
const create = (body: unknown) => call(POST, "/api/vault", body);
const update = (id: string, body: unknown) =>
  call(PUT, `/api/vault/${id}`, body, { method: "PUT", params: { params: { id } } });
const remove = (id: string) =>
  call(DELETE, `/api/vault/${id}`, undefined, { method: "DELETE", params: { params: { id } } });

let myKeyHex = "";

beforeAll(() => {
  myKeyHex = generateVaultKey().toString("hex");
});

beforeEach(() => {
  resetDb();
  resetSession();
  vi.restoreAllMocks();
  signInAs(ME, myKeyHex);
});

describe("authentication", () => {
  it("every vault route needs a session", async () => {
    resetSession();
    expect((await list()).status).toBe(401);
    expect((await create({ label: "x", password: "y" })).status).toBe(401);
    expect((await update("any", { favorite: true })).status).toBe(401);
    expect((await remove("any")).status).toBe(401);
  });
});

describe("creating entries", () => {
  it("encrypts the secret fields and never stores them in plaintext", async () => {
    const res = await create({
      label: "GitHub", category: "Work", websiteUrl: "https://github.com",
      username: "octocat", password: "p@ssw0rd-very-secret", notes: "recovery codes in the safe",
    });
    expect(res.status).toBe(200);

    const row = entries.get(res.body?.id)!;
    for (const cipher of [row.usernameCipher, row.passwordCipher, row.notesCipher!]) {
      expect(cipher.startsWith("v2:")).toBe(true);
    }
    const stored = JSON.stringify(row);
    for (const secret of ["octocat", "p@ssw0rd-very-secret", "recovery codes in the safe"]) {
      expect(stored).not.toContain(secret);
    }
    // label / category / url stay in the clear on purpose (searchable)
    expect(row.label).toBe("GitHub");
    expect(row.websiteUrl).toBe("https://github.com");
  });

  it("ignores id, userId, createdAt and updatedAt sent by the browser", async () => {
    const res = await create({
      label: "Sneaky", username: "u", password: "p",
      id: "chosen-by-attacker",
      userId: OTHER,
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
    });

    const row = entries.get(res.body?.id)!;
    expect(res.body?.id).not.toBe("chosen-by-attacker");
    expect(row.userId).toBe(ME);
    expect(row.createdAt.getFullYear()).toBeGreaterThan(2020);
    expect(row.updatedAt.getFullYear()).toBeGreaterThan(2020);
  });

  it("validates input", async () => {
    expect((await create({ password: "p" })).status).toBe(400); // no label
    expect((await create({ label: "x" })).status).toBe(400); // no password
    expect((await create({ label: "x".repeat(81), password: "p" })).status).toBe(400);
  });
});

describe("listing entries", () => {
  it("returns decrypted fields plus createdAt and updatedAt", async () => {
    await create({ label: "Mail", username: "me@example.com", password: "pw-1", notes: "a note" });
    const res = await list();

    expect(res.status).toBe(200);
    const [entry] = res.body as Record<string, any>[];
    expect(entry).toMatchObject({ label: "Mail", username: "me@example.com", password: "pw-1", notes: "a note" });
    expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
    expect(Number.isNaN(Date.parse(entry.updatedAt))).toBe(false);
  });

  it("puts favorites first, then sorts by label, and only returns the caller's entries", async () => {
    await create({ label: "Zeta", username: "u", password: "p" });
    await create({ label: "Alpha", username: "u", password: "p" });
    await create({ label: "Mid", username: "u", password: "p", favorite: true });

    signInAs(OTHER, generateVaultKey().toString("hex"));
    await create({ label: "Not mine", username: "u", password: "p" });
    signInAs(ME, myKeyHex);

    const labels = (await list()).body as Record<string, any>[];
    expect(labels.map((e) => e.label)).toEqual(["Mid", "Alpha", "Zeta"]);
  });

  it("fails cleanly if a ciphertext was swapped between entries (it is bound to entry and field)", async () => {
    const a = (await create({ label: "A", username: "u", password: "password-a" })).body?.id;
    const b = (await create({ label: "B", username: "u", password: "password-b" })).body?.id;

    entries.get(b)!.passwordCipher = entries.get(a)!.passwordCipher;

    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await list()).status).toBe(500);
  });
});

describe("editing entries", () => {
  it("toggling favorite touches nothing else", async () => {
    const id = (await create({ label: "Mail", username: "u", password: "p" })).body?.id;
    const before = { ...entries.get(id)! };

    const res = await update(id, { favorite: true });
    expect(res.status).toBe(200);

    const after = entries.get(id)!;
    expect(after.favorite).toBe(true);
    expect(after.usernameCipher).toBe(before.usernameCipher);
    expect(after.passwordCipher).toBe(before.passwordCipher);
    expect(after.label).toBe("Mail");
  });

  it("keeps createdAt fixed and moves updatedAt when an entry is edited", async () => {
    const id = (await create({ label: "Mail", username: "u", password: "old-password" })).body?.id;
    const before = { ...entries.get(id)! };
    await sleep(15);

    expect((await update(id, { label: "Mail 2", password: "new-password" })).status).toBe(200);

    const after = entries.get(id)!;
    expect(after.createdAt.getTime()).toBe(before.createdAt.getTime());
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());

    const [entry] = (await list()).body as Record<string, any>[];
    expect(entry.password).toBe("new-password");
    expect(entry.label).toBe("Mail 2");
  });

  it("never writes createdAt, updatedAt, id or userId, even if the browser sends them", async () => {
    const id = (await create({ label: "Mail", username: "u", password: "p" })).body?.id;
    const before = { ...entries.get(id)! };
    const spy = vi.spyOn(prisma.vaultEntry, "updateMany");

    await update(id, {
      label: "Renamed",
      createdAt: "1999-01-01T00:00:00.000Z",
      updatedAt: "1999-01-01T00:00:00.000Z",
      userId: OTHER,
      id: "different",
    });

    const data = spy.mock.calls[0][0].data as Record<string, unknown>;
    for (const forbidden of ["createdAt", "updatedAt", "userId", "id"]) {
      expect(data).not.toHaveProperty(forbidden);
    }
    expect(entries.get(id)!.createdAt.getTime()).toBe(before.createdAt.getTime());
    expect(entries.get(id)!.userId).toBe(ME);
  });

  it("clears the website and notes when they are sent empty", async () => {
    const id = (await create({
      label: "Mail", username: "u", password: "p", websiteUrl: "https://example.com", notes: "n",
    })).body?.id;

    await update(id, { websiteUrl: "", notes: "" });
    const row = entries.get(id)!;
    expect(row.websiteUrl).toBeNull();
    expect(row.notesCipher).toBeNull();
  });

  it("validates input", async () => {
    const id = (await create({ label: "Mail", username: "u", password: "p" })).body?.id;
    expect((await update(id, { label: "x".repeat(81) })).status).toBe(400);
  });
});

describe("ownership", () => {
  it("cannot edit or delete someone else's entry (404, and nothing changes)", async () => {
    signInAs(OTHER, generateVaultKey().toString("hex"));
    const theirs = (await create({ label: "Theirs", username: "u", password: "p" })).body?.id;
    const before = JSON.stringify(entries.get(theirs));

    signInAs(ME, myKeyHex);
    expect((await update(theirs, { label: "Hijacked" })).status).toBe(404);
    expect((await remove(theirs)).status).toBe(404);
    expect(JSON.stringify(entries.get(theirs))).toBe(before);
  });

  it("deletes your own entry", async () => {
    const id = (await create({ label: "Mine", username: "u", password: "p" })).body?.id;
    expect((await remove(id)).status).toBe(200);
    expect(entries.has(id)).toBe(false);
  });
});