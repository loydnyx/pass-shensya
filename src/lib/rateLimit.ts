import { createHash } from "crypto";

/**
 * Rate limiter for login / recovery / recovery-key regeneration.
 *
 * - With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set (or the
 *   KV_REST_API_URL / KV_REST_API_TOKEN pair that Vercel's Upstash
 *   integration creates), counters live in Redis, so every serverless
 *   instance sees the same numbers.
 * - With no Redis configured, or if Redis is unreachable / slow / errors,
 *   it falls back to a per-instance in-memory limiter. That is weaker (each
 *   instance counts on its own) but never turns "Redis is down" into either
 *   "everyone is locked out" or "no limit at all".
 *
 * Fixed window: the first attempt starts the window; attempts beyond `max`
 * inside it are refused until the window ends.
 *
 * Redis keys are a SHA-256 of the caller's key, so emails and IP addresses
 * are never written to Redis in the clear. No extra dependency: it talks to
 * Upstash's REST pipeline endpoint with fetch().
 */

export type RateLimitResult = { allowed: boolean; retryAfterSeconds?: number };
export type RateLimitOptions = { max?: number; windowMs?: number };

const DEFAULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const DEFAULT_MAX_ATTEMPTS = 8;
const KEY_PREFIX = "ps:rl:";
const REDIS_TIMEOUT_MS = 1500;

/* -------------------------------------------------------------------------- */
/* Redis (Upstash REST)                                                       */
/* -------------------------------------------------------------------------- */

type RedisConfig = { url: string; token: string };
type RedisCommand = (string | number)[];

// Read on every call (not at import time) so tests and hot-reloaded env
// changes are picked up.
function getRedisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/+$/, ""), token };
}

async function redisPipeline(config: RedisConfig, commands: RedisCommand[]): Promise<unknown[]> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
    cache: "no-store",
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Redis responded with HTTP ${response.status}`);

  const data: unknown = await response.json();
  if (!Array.isArray(data) || data.length !== commands.length) {
    throw new Error("Unexpected Redis response");
  }

  return data.map((item: { result?: unknown; error?: string }) => {
    if (item.error) throw new Error("Redis command failed");
    return item.result;
  });
}

function redisKey(key: string): string {
  return KEY_PREFIX + createHash("sha256").update(key).digest("hex");
}

async function redisCheck(
  config: RedisConfig,
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const k = redisKey(key);

  const [count, pttl] = await redisPipeline(config, [
    ["INCR", k],
    ["PTTL", k],
  ]);

  let remainingMs = Number(pttl);
  if (!(remainingMs > 0)) {
    // First hit in a window, or a key that somehow has no expiry (e.g. the
    // process died between INCR and this call). Either way, (re)arm the
    // window so a counter can never get stuck and lock someone out forever.
    await redisPipeline(config, [["PEXPIRE", k, windowMs]]);
    remainingMs = windowMs;
  }

  if (Number(count) > max) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)) };
  }
  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* In-memory fallback (per instance)                                          */
/* -------------------------------------------------------------------------- */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function cleanupExpired() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}

// Sweep expired buckets so the Map can't grow unbounded from attacker-made
// keys. unref() so this timer never keeps the Node process alive.
if (typeof setInterval !== "undefined") {
  const interval = setInterval(cleanupExpired, DEFAULT_WINDOW_MS);
  interval.unref?.();
}

function memoryCheck(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { allowed: true };
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

let warnedNoRedis = false;
let lastRedisErrorLog = 0;

function logRedisProblem(err: unknown) {
  // Throttled, and never includes the URL, token or key.
  const now = Date.now();
  if (now - lastRedisErrorLog < 30_000) return;
  lastRedisErrorLog = now;
  console.error(
    "rate limit: Redis unavailable, using in-memory fallback:",
    err instanceof Error ? err.message : "unknown error",
  );
}

/**
 * Counts one attempt against `key` and says whether it is allowed.
 * Call it BEFORE doing expensive or sensitive work (password hashing, etc.).
 */
export async function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const max = options.max ?? DEFAULT_MAX_ATTEMPTS;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;

  const config = getRedisConfig();
  if (!config) {
    if (process.env.NODE_ENV === "production" && !warnedNoRedis) {
      warnedNoRedis = true;
      console.warn(
        "rate limit: UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not set. " +
          "Using per-instance in-memory limits, which do not work across serverless instances.",
      );
    }
    return memoryCheck(key, max, windowMs);
  }

  try {
    return await redisCheck(config, key, max, windowMs);
  } catch (err) {
    logRedisProblem(err);
    return memoryCheck(key, max, windowMs);
  }
}

/** Clears the counter, e.g. after a successful sign-in. */
export async function resetRateLimit(key: string): Promise<void> {
  buckets.delete(key);

  const config = getRedisConfig();
  if (!config) return;

  try {
    await redisPipeline(config, [["DEL", redisKey(key)]]);
  } catch (err) {
    logRedisProblem(err);
  }
}

/** Human-friendly "try again" text for a 429 response. */
export function rateLimitMessage(retryAfterSeconds: number | undefined): string {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds ?? 60));
  if (seconds < 60) return `Too many attempts. Try again in ${seconds} seconds.`;
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}