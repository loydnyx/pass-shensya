import http from "node:http";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, rateLimitMessage, resetRateLimit } from "@/lib/rateLimit";

/* -------------------------------------------------------------------------- */
/* A tiny fake of Upstash's REST pipeline endpoint (INCR / PTTL / PEXPIRE / DEL) */
/* -------------------------------------------------------------------------- */

const TOKEN = "test-token-abc123";
const store = new Map<string, { value: number; expiresAt: number | null }>();
const seenKeys: string[] = [];
let lastAuthorization = "";
let mode: "ok" | "unauthorized" | "hang" = "ok";
let server: http.Server;
let baseUrl = "";

function run(command: (string | number)[]): { result?: number; error?: string } {
  const [name, rawKey, arg] = command;
  const key = String(rawKey);
  seenKeys.push(key);

  const now = Date.now();
  const existing = store.get(key);
  if (existing && existing.expiresAt !== null && now >= existing.expiresAt) store.delete(key);
  const current = store.get(key);

  switch (name) {
    case "INCR": {
      const value = (current?.value ?? 0) + 1;
      store.set(key, { value, expiresAt: current?.expiresAt ?? null });
      return { result: value };
    }
    case "PTTL":
      return { result: !current ? -2 : current.expiresAt === null ? -1 : current.expiresAt - now };
    case "PEXPIRE":
      if (current) current.expiresAt = now + Number(arg);
      return { result: current ? 1 : 0 };
    case "DEL":
      return { result: store.delete(key) ? 1 : 0 };
    default:
      return { error: "ERR unknown command" };
  }
}

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      lastAuthorization = String(req.headers.authorization);
      if (mode === "hang") return; // never answer
      if (mode === "unauthorized" || req.url !== "/pipeline") {
        res.writeHead(401);
        return res.end("{}");
      }
      const commands: (string | number)[][] = JSON.parse(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(commands.map(run)));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
    delete process.env[name];
  }
});

let counter = 0;
const uniqueKey = (label: string) => `test:${label}:${++counter}:person@example.com`;
const hashed = (key: string) => "ps:rl:" + createHash("sha256").update(key).digest("hex");

function useRedis() {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  process.env.UPSTASH_REDIS_REST_URL = `${baseUrl}/`; // trailing slash on purpose
  process.env.UPSTASH_REDIS_REST_TOKEN = TOKEN;
}

beforeEach(() => {
  store.clear();
  seenKeys.length = 0;
  mode = "ok";
  useRedis();
});

/* -------------------------------------------------------------------------- */

describe("with Redis", () => {
  it("allows up to `max` attempts, then blocks with a retry time", async () => {
    const key = uniqueKey("max");
    for (let i = 0; i < 3; i++) {
      expect((await checkRateLimit(key, { max: 3, windowMs: 60_000 })).allowed).toBe(true);
    }

    const blocked = await checkRateLimit(key, { max: 3, windowMs: 60_000 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("defaults to 8 attempts per window", async () => {
    const key = uniqueKey("default");
    for (let i = 0; i < 8; i++) expect((await checkRateLimit(key)).allowed).toBe(true);
    expect((await checkRateLimit(key)).allowed).toBe(false);
  });

  it("authenticates with the bearer token and tolerates a trailing slash in the URL", async () => {
    await checkRateLimit(uniqueKey("auth"));
    expect(lastAuthorization).toBe(`Bearer ${TOKEN}`);
  });

  it("stores only a hash of the key, never the email or IP", async () => {
    const key = "login:198.51.100.7:person@example.com";
    await checkRateLimit(key);

    expect(seenKeys.length).toBeGreaterThan(0);
    for (const stored of seenKeys) {
      expect(stored).toBe(hashed(key));
      expect(stored).not.toContain("person@example.com");
      expect(stored).not.toContain("198.51.100.7");
    }
  });

  it("keeps different keys independent", async () => {
    const a = uniqueKey("a");
    const b = uniqueKey("b");
    await checkRateLimit(a, { max: 1 });
    expect((await checkRateLimit(a, { max: 1 })).allowed).toBe(false);
    expect((await checkRateLimit(b, { max: 1 })).allowed).toBe(true);
  });

  it("lets the window expire", async () => {
    const key = uniqueKey("expiry");
    await checkRateLimit(key, { max: 1, windowMs: 300 });
    expect((await checkRateLimit(key, { max: 1, windowMs: 300 })).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect((await checkRateLimit(key, { max: 1, windowMs: 300 })).allowed).toBe(true);
  });

  it("resetRateLimit clears the counter", async () => {
    const key = uniqueKey("reset");
    await checkRateLimit(key, { max: 1 });
    expect((await checkRateLimit(key, { max: 1 })).allowed).toBe(false);

    await resetRateLimit(key);
    expect((await checkRateLimit(key, { max: 1 })).allowed).toBe(true);
  });

  it("repairs a counter that lost its expiry, so nobody is locked out forever", async () => {
    const key = uniqueKey("stuck");
    store.set(hashed(key), { value: 99, expiresAt: null }); // e.g. process died between INCR and PEXPIRE

    const result = await checkRateLimit(key, { max: 3, windowMs: 300 });
    expect(result.allowed).toBe(false);
    expect(store.get(hashed(key))?.expiresAt).not.toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 350));
    expect((await checkRateLimit(key, { max: 3, windowMs: 300 })).allowed).toBe(true);
  });

  it("also reads the KV_REST_API_* variable names used by Vercel's integration", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = baseUrl;
    process.env.KV_REST_API_TOKEN = TOKEN;

    await checkRateLimit(uniqueKey("kv"));
    expect(seenKeys.length).toBeGreaterThan(0);
  });
});

describe("fallback to the in-memory limiter", () => {
  it("still limits when Redis rejects the request, and does not log the token or URL", async () => {
    const logged: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args.join(" "));
    });
    mode = "unauthorized";

    const key = uniqueKey("fallback");
    for (let i = 0; i < 8; i++) expect((await checkRateLimit(key)).allowed).toBe(true);
    expect((await checkRateLimit(key)).allowed).toBe(false);

    spy.mockRestore();
    for (const line of logged) {
      expect(line).not.toContain(TOKEN);
      expect(line).not.toContain("127.0.0.1");
    }
  });

  it("gives up on a hung Redis after about a second and a half", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mode = "hang";

    const started = Date.now();
    const result = await checkRateLimit(uniqueKey("hang"));

    expect(result.allowed).toBe(true);
    expect(Date.now() - started).toBeLessThan(3000);
    vi.restoreAllMocks();
  });

  it("works with no Redis configured at all", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const key = uniqueKey("nocfg");
    for (let i = 0; i < 8; i++) await checkRateLimit(key);
    expect((await checkRateLimit(key)).allowed).toBe(false);
    expect(seenKeys).toHaveLength(0);
  });

  it("in-memory resetRateLimit clears the counter", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const key = uniqueKey("memreset");
    await checkRateLimit(key, { max: 1 });
    expect((await checkRateLimit(key, { max: 1 })).allowed).toBe(false);
    await resetRateLimit(key);
    expect((await checkRateLimit(key, { max: 1 })).allowed).toBe(true);
  });
});

describe("rateLimitMessage", () => {
  it("speaks in seconds under a minute", () => {
    expect(rateLimitMessage(45)).toBe("Too many attempts. Try again in 45 seconds.");
  });

  it("rounds up to minutes", () => {
    expect(rateLimitMessage(553)).toBe("Too many attempts. Try again in about 10 minutes.");
    expect(rateLimitMessage(60)).toBe("Too many attempts. Try again in about 1 minute.");
  });

  it("has a safe default", () => {
    expect(rateLimitMessage(undefined)).toContain("about 1 minute");
  });
});