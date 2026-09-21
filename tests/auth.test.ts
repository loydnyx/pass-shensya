import bcrypt from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deriveKeyFromSecret,
  generateRecoveryKey,
  generateSaltHex,
  generateVaultKey,
  unwrapKey,
  wrapKey,
} from "@/lib/crypto";
import { call } from "./helpers/http";
import { prisma, resetDb, users } from "./helpers/fakeDb";
import { resetSession, sessionState, signInAs } from "./helpers/fakeSession";

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
import { POST as deleteAccount } from "@/app/api/auth/delete-account/route";

const PASSWORD = "correct horse battery staple";
const NEW_PASSWORD = "a brand new long passphrase 42";
const KEY_FORMAT = /^([0-9A-F]{4}-){7}[0-9A-F]{4}$/;

let counter = 0;
const nextIp = () => `198.51.100.${++counter % 250}`;

/** A user created directly (bcrypt cost 4) so tests that need many accounts stay fast. */
async function seedUser(password = PASSWORD) {
  const n = ++counter;
  const vaultKey = generateVaultKey();
  const vaultSalt = generateSaltHex();
  const recoveryKey = generateRecoveryKey();
  const recoverySalt = generateSaltHex();
  const id = `user-${n}`;
  const email = `user${n}@example.com`;

  users.set(id, {
    id,
    email,
    displayName: "Test User",
    passwordHash: await bcrypt.hash(password, 4),
    vaultSalt,
    vaultKeyWrapped: wrapKey(vaultKey, await deriveKeyFromSecret(password, vaultSalt), "password"),
    recoverySalt,
    recoveryKeyWrapped: wrapKey(vaultKey, await deriveKeyFromSecret(recoveryKey, recoverySalt), "recovery"),
    createdAt: new Date(),
  });

  return { id, email, password, vaultKey, recoveryKey };
}

beforeAll(() => {
  // Redis is covered in rateLimit.test.ts; here the in-memory limiter is used.
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
});

beforeEach(() => {
  resetDb();
  resetSession();
  vi.restoreAllMocks();
});

/* -------------------------------------------------------------------------- */

describe("signup", () => {
  it("creates an account, shows the Recovery Key once, and stores no plaintext secrets", async () => {
    const res = await call(signup, "/api/auth/signup", {
      displayName: "Jane",
      email: "Jane@Example.com",
      password: PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body?.recoveryKey).toMatch(KEY_FORMAT);
    expect(res.body?.email).toBe("jane@example.com"); // normalized

    const record = [...users.values()][0];
    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain(res.body?.recoveryKey);
    expect(record.passwordHash.startsWith("$2")).toBe(true);
    expect(record.vaultKeyWrapped.startsWith("v2:")).toBe(true);
    expect(record.recoveryKeyWrapped.startsWith("v2:")).toBe(true);
  });

  it("wraps ONE vault key two ways: master password and Recovery Key both open it", async () => {
    const res = await call(signup, "/api/auth/signup", { displayName: "Jane", email: "j@example.com", password: PASSWORD });
    const record = [...users.values()][0];
    const sessionKey = sessionState.created[0].vaultKeyHex;

    const viaPassword = unwrapKey(
      record.vaultKeyWrapped,
      await deriveKeyFromSecret(PASSWORD, record.vaultSalt),
      "password",
    );
    const viaRecovery = unwrapKey(
      record.recoveryKeyWrapped,
      await deriveKeyFromSecret(res.body?.recoveryKey, record.recoverySalt),
      "recovery",
    );

    expect(viaPassword.toString("hex")).toBe(sessionKey);
    expect(viaRecovery.toString("hex")).toBe(sessionKey);
  });

  it("rejects a duplicate email with 409", async () => {
    await call(signup, "/api/auth/signup", { displayName: "Jane", email: "j@example.com", password: PASSWORD });
    const again = await call(signup, "/api/auth/signup", { displayName: "Jane", email: "J@EXAMPLE.com", password: PASSWORD });
    expect(again.status).toBe(409);
  });

  it("turns a unique-constraint race into a clean 409", async () => {
    await seedUser();
    const [existing] = [...users.values()];
    vi.spyOn(prisma.user, "findUnique").mockResolvedValueOnce(null); // the pre-check misses it...

    const res = await call(signup, "/api/auth/signup", {
      displayName: "Jane",
      email: existing.email,
      password: PASSWORD,
    });
    expect(res.status).toBe(409); // ...but the database constraint catches it
  });

  it("rejects a master password shorter than 14 characters", async () => {
    const res = await call(signup, "/api/auth/signup", { displayName: "Jane", email: "j@example.com", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body?.error).toContain("at least 14");
    expect(users.size).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

describe("login", () => {
  it("signs in with the right password and opens the same vault key", async () => {
    const user = await seedUser();
    const res = await call(login, "/api/auth/login", { email: user.email, password: PASSWORD }, { ip: nextIp() });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body ?? {}).sort()).toEqual(["displayName", "email", "id"]);
    expect(sessionState.created.at(-1)?.vaultKeyHex).toBe(user.vaultKey.toString("hex"));
  });

  it("gives the same generic 401 for a wrong password and for an unknown email", async () => {
    const user = await seedUser();
    const wrong = await call(login, "/api/auth/login", { email: user.email, password: "nope" }, { ip: nextIp() });
    const unknown = await call(login, "/api/auth/login", { email: "nobody@example.com", password: "nope" }, { ip: nextIp() });

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
    expect(sessionState.created).toHaveLength(0);
  });

  it("blocks after 8 failures from one client, with a friendly message and Retry-After", async () => {
    const user = await seedUser();
    const ip = nextIp();
    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) {
      statuses.push((await call(login, "/api/auth/login", { email: user.email, password: "wrong" }, { ip })).status);
    }
    expect(statuses.slice(0, 8)).toEqual(Array(8).fill(401));
    expect(statuses[8]).toBe(429);

    const blocked = await call(login, "/api/auth/login", { email: user.email, password: PASSWORD }, { ip });
    expect(blocked.status).toBe(429); // even the right password waits its turn
    expect(blocked.body?.error).toMatch(/Try again in about \d+ minutes?\./);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("still stops an attacker who rotates IP addresses (account-level cap of 30)", async () => {
    const user = await seedUser();
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) {
      statuses.push(
        (await call(login, "/api/auth/login", { email: user.email, password: "wrong" }, { ip: `192.0.2.${i + 1}` })).status,
      );
    }
    expect(statuses.slice(0, 30)).toEqual(Array(30).fill(401));
    expect(statuses[30]).toBe(429);
  });

  it("resets the counters after a successful sign-in", async () => {
    const user = await seedUser();
    const ip = nextIp();
    for (let i = 0; i < 5; i++) await call(login, "/api/auth/login", { email: user.email, password: "wrong" }, { ip });
    expect((await call(login, "/api/auth/login", { email: user.email, password: PASSWORD }, { ip })).status).toBe(200);

    for (let i = 0; i < 8; i++) {
      expect((await call(login, "/api/auth/login", { email: user.email, password: "wrong" }, { ip })).status).toBe(401);
    }
  });

  it("rejects malformed input before touching the database", async () => {
    expect((await call(login, "/api/auth/login", { email: "not-an-email", password: "x" })).status).toBe(400);
    expect((await call(login, "/api/auth/login", {})).status).toBe(400);
  });
});

/* -------------------------------------------------------------------------- */

describe("recover (with Recovery Key rotation)", () => {
  it("resets the master password, keeps the SAME vault key, and issues a NEW Recovery Key", async () => {
    const user = await seedUser();
    const res = await call(recover, "/api/auth/recover", {
      email: user.email,
      recoveryKey: user.recoveryKey,
      newPassword: NEW_PASSWORD,
    }, { ip: nextIp() });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body ?? {}).sort()).toEqual(["displayName", "email", "id", "recoveryKey"]);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const newKey: string = res.body?.recoveryKey;
    expect(newKey).toMatch(KEY_FORMAT);
    expect(newKey).not.toBe(user.recoveryKey);

    const record = users.get(user.id)!;
    const viaPassword = unwrapKey(record.vaultKeyWrapped, await deriveKeyFromSecret(NEW_PASSWORD, record.vaultSalt), "password");
    const viaNewKey = unwrapKey(record.recoveryKeyWrapped, await deriveKeyFromSecret(newKey, record.recoverySalt), "recovery");

    expect(viaPassword.equals(user.vaultKey)).toBe(true);
    expect(viaNewKey.equals(user.vaultKey)).toBe(true);
    expect(await bcrypt.compare(NEW_PASSWORD, record.passwordHash)).toBe(true);
    expect(await bcrypt.compare(PASSWORD, record.passwordHash)).toBe(false);
    expect(sessionState.created.at(-1)?.vaultKeyHex).toBe(user.vaultKey.toString("hex"));
  });

  it("a Recovery Key works exactly once: the used key is rejected, the new one works", async () => {
    const user = await seedUser();
    const first = await call(recover, "/api/auth/recover", {
      email: user.email, recoveryKey: user.recoveryKey, newPassword: NEW_PASSWORD,
    }, { ip: nextIp() });

    const reused = await call(recover, "/api/auth/recover", {
      email: user.email, recoveryKey: user.recoveryKey, newPassword: NEW_PASSWORD + "!",
    }, { ip: nextIp() });
    expect(reused.status).toBe(400);

    const withNew = await call(recover, "/api/auth/recover", {
      email: user.email, recoveryKey: first.body?.recoveryKey, newPassword: NEW_PASSWORD + "?",
    }, { ip: nextIp() });
    expect(withNew.status).toBe(200);
  });

  it("accepts a sloppily typed key (lowercase, spaces instead of dashes)", async () => {
    const user = await seedUser();
    const res = await call(recover, "/api/auth/recover", {
      email: user.email, recoveryKey: user.recoveryKey.toLowerCase().replace(/-/g, " "), newPassword: NEW_PASSWORD,
    }, { ip: nextIp() });
    expect(res.status).toBe(200);
  });

  it("gives one generic 400 for a wrong key, a malformed key and an unknown email, and changes nothing", async () => {
    const user = await seedUser();
    const before = JSON.stringify(users.get(user.id));

    const wrong = await call(recover, "/api/auth/recover", { email: user.email, recoveryKey: generateRecoveryKey(), newPassword: NEW_PASSWORD }, { ip: nextIp() });
    const malformed = await call(recover, "/api/auth/recover", { email: user.email, recoveryKey: "nope", newPassword: NEW_PASSWORD }, { ip: nextIp() });
    const unknown = await call(recover, "/api/auth/recover", { email: "nobody@example.com", recoveryKey: user.recoveryKey, newPassword: NEW_PASSWORD }, { ip: nextIp() });

    for (const res of [wrong, malformed, unknown]) expect(res.status).toBe(400);
    expect(wrong.body).toEqual(malformed.body);
    expect(wrong.body).toEqual(unknown.body);
    expect(JSON.stringify(users.get(user.id))).toBe(before);
    expect(sessionState.created).toHaveLength(0);
  });

  it("enforces the 14-character minimum on the new password", async () => {
    const user = await seedUser();
    const res = await call(recover, "/api/auth/recover", { email: user.email, recoveryKey: user.recoveryKey, newPassword: "short" }, { ip: nextIp() });
    expect(res.status).toBe(400);
  });

  it("rate-limits repeated attempts", async () => {
    const user = await seedUser();
    const ip = nextIp();
    let last = 0;
    for (let i = 0; i < 9; i++) {
      last = (await call(recover, "/api/auth/recover", { email: user.email, recoveryKey: generateRecoveryKey(), newPassword: NEW_PASSWORD }, { ip })).status;
    }
    expect(last).toBe(429);
  });
});

/* -------------------------------------------------------------------------- */

describe("regenerate-recovery", () => {
  it("needs a session", async () => {
    expect((await call(regenerate, "/api/auth/regenerate-recovery", { password: PASSWORD })).status).toBe(401);
  });

  it("needs the master password, and changes nothing when it is wrong", async () => {
    const user = await seedUser();
    signInAs(user.id, user.vaultKey.toString("hex"));
    const before = JSON.stringify(users.get(user.id));

    const res = await call(regenerate, "/api/auth/regenerate-recovery", { password: "wrong" });
    expect(res.status).toBe(401);
    expect(JSON.stringify(users.get(user.id))).toBe(before);
  });

  it("issues a new key for the SAME vault key and kills the old one", async () => {
    const user = await seedUser();
    signInAs(user.id, user.vaultKey.toString("hex"));

    const res = await call(regenerate, "/api/auth/regenerate-recovery", { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(Object.keys(res.body ?? {})).toEqual(["recoveryKey"]);
    expect(res.headers.get("cache-control")).toBe("no-store");

    const record = users.get(user.id)!;
    const viaNew = unwrapKey(record.recoveryKeyWrapped, await deriveKeyFromSecret(res.body?.recoveryKey, record.recoverySalt), "recovery");
    expect(viaNew.equals(user.vaultKey)).toBe(true);

    const oldStillWorks = async () => {
      try {
        unwrapKey(record.recoveryKeyWrapped, await deriveKeyFromSecret(user.recoveryKey, record.recoverySalt), "recovery");
        return true;
      } catch {
        return false;
      }
    };
    expect(await oldStillWorks()).toBe(false);
  });

  it("rate-limits password guesses per user", async () => {
    const user = await seedUser();
    signInAs(user.id, user.vaultKey.toString("hex"));
    let last = 0;
    for (let i = 0; i < 9; i++) last = (await call(regenerate, "/api/auth/regenerate-recovery", { password: "nope" })).status;
    expect(last).toBe(429);
  });
});

/* -------------------------------------------------------------------------- */

describe("delete-account", () => {
  it("needs a session and a password", async () => {
    const user = await seedUser();
    expect((await call(deleteAccount, "/api/auth/delete-account", { password: PASSWORD })).status).toBe(401);

    signInAs(user.id, user.vaultKey.toString("hex"));
    expect((await call(deleteAccount, "/api/auth/delete-account", { password: "" })).status).toBe(400);
  });

  it("rate-limits password guesses, even blocking the right password while limited", async () => {
    const user = await seedUser();
    signInAs(user.id, user.vaultKey.toString("hex"));

    const statuses: number[] = [];
    for (let i = 0; i < 9; i++) statuses.push((await call(deleteAccount, "/api/auth/delete-account", { password: "wrong" })).status);
    expect(statuses.slice(0, 8)).toEqual(Array(8).fill(401));
    expect(statuses[8]).toBe(429);

    const right = await call(deleteAccount, "/api/auth/delete-account", { password: PASSWORD });
    expect(right.status).toBe(429);
    expect(users.has(user.id)).toBe(true);
  });

  it("deletes the account and ends the session when the password is right", async () => {
    const user = await seedUser();
    signInAs(user.id, user.vaultKey.toString("hex"));

    const res = await call(deleteAccount, "/api/auth/delete-account", { password: PASSWORD });
    expect(res.status).toBe(200);
    expect(users.has(user.id)).toBe(false);
    expect(sessionState.cleared).toBe(1);
  });
});