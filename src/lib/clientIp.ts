import { NextRequest } from "next/server";

/**
 * Best-effort client IP for rate-limiting keys. `x-forwarded-for` is
 * whatever the nearest hop sets it to — trustworthy only if a proxy you
 * control (Vercel, a properly configured nginx/Cloudflare in front of this
 * app) overwrites it before the request reaches Next.js, which is the
 * common case in production. Self-hosting with no trusted proxy means a
 * client can set this header itself and spoof a fresh IP on every request,
 * defeating IP-based rate limiting entirely — the account-level lockout
 * this app also has (via email-keyed buckets) is the backstop for that case.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}