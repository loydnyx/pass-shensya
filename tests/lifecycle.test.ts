import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { call } from "./helpers/http";
import { resetDb } from "./helpers/fakeDb";
import { clearSession, resetSession } from "./helpers/fakeSession";

vi.mock("@/lib/db", () => import("./helpers/fakeDb"));
vi.mock("@/lib/session", () => import("./helpers/fakeSession"));
vi.mock("@prisma/client", async () => {
  const { FakeKnownError } = await import("./helpers/fakeDb");
  return { Prisma: { PrismaClientKnownRequestError: FakeKnownError } };
});

import { POST as signup } from "@/app/api/auth/signup/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as recover } from "@/app/api/auth/recover/route";
import { POST as regenerate } from "@/app/api/auth/regenerate-recovery/route";
import { GET, POST as addEntry } from "@/app/api/vault/route";

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a brand new long passphrase 42";
const EMAIL = "lifecycle@example.com";

const vault = async () => (await call(GET, "/api/vault", undefined, { method: "GET" })).body as Record<string, any>[];

beforeAll(() => {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

beforeEach(() => {
  resetDb();
  resetSession();
});

describe("a whole account lifetime", () => {
  it("keeps the vault intact through sign-out, sign-in, recovery and key regeneration", async () => {
    // 1. Sign up and store an entry.
    const created = await call(signup, "/api/auth/signup", { displayName: "Life Cycle", email: EMAIL, password: PASSWORD });
    expect(created.status).toBe(200);
    const firstKey: string = created.body?.recoveryKey;

    await call(addEntry, "/api/vault", {
      label: "Bank", category: "Banking", username: "me@bank.example", password: "s3cret-bank-pw", notes: "PIN is in the safe",
    });

    // 2. Sign out and back in: the same entry decrypts.
    clearSession();
    expect((await call(GET, "/api/vault", undefined, { method: "GET" })).status).toBe(401); // signed out
    expect((await call(login, "/api/auth/login", { email: EMAIL, password: PASSWORD }, { ip: "192.0.2.1" })).status).toBe(200);
    expect((await vault())[0]).toMatchObject({ label: "Bank", username: "me@bank.example", password: "s3cret-bank-pw", notes: "PIN is in the safe" });

    // 3. Forget the password: recover with the Recovery Key, which rotates it.
    clearSession();
    const recovered = await call(recover, "/api/auth/recover", { email: EMAIL, recoveryKey: firstKey, newPassword: NEW_PASSWORD }, { ip: "192.0.2.2" });
    expect(recovered.status).toBe(200);
    const secondKey: string = recovered.body?.recoveryKey;
    expect(secondKey).not.toBe(firstKey);

    // The vault survived: same plaintext, decrypted with the new session.
    expect((await vault())[0]).toMatchObject({ label: "Bank", password: "s3cret-bank-pw", notes: "PIN is in the safe" });

    // The old password and the used key are dead; the new password works.
    clearSession();
    expect((await call(login, "/api/auth/login", { email: EMAIL, password: PASSWORD }, { ip: "192.0.2.3" })).status).toBe(401);
    expect((await call(recover, "/api/auth/recover", { email: EMAIL, recoveryKey: firstKey, newPassword: NEW_PASSWORD + "x" }, { ip: "192.0.2.4" })).status).toBe(400);
    expect((await call(login, "/api/auth/login", { email: EMAIL, password: NEW_PASSWORD }, { ip: "192.0.2.5" })).status).toBe(200);

    // 4. Replace the key from the dashboard: the previous one stops working, the vault is untouched.
    const regenerated = await call(regenerate, "/api/auth/regenerate-recovery", { password: NEW_PASSWORD });
    expect(regenerated.status).toBe(200);
    const thirdKey: string = regenerated.body?.recoveryKey;

    clearSession();
    expect((await call(recover, "/api/auth/recover", { email: EMAIL, recoveryKey: secondKey, newPassword: NEW_PASSWORD + "y" }, { ip: "192.0.2.6" })).status).toBe(400);
    expect((await call(recover, "/api/auth/recover", { email: EMAIL, recoveryKey: thirdKey, newPassword: NEW_PASSWORD + "z" }, { ip: "192.0.2.7" })).status).toBe(200);
    expect((await vault())[0]).toMatchObject({ label: "Bank", password: "s3cret-bank-pw" });
  });
});