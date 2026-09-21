import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const run = () => middleware(new NextRequest("http://localhost/login"));
const nonceOf = (csp: string) => /'nonce-([^']+)'/.exec(csp)?.[1];

describe("Content-Security-Policy middleware", () => {
  it("sets a CSP with a nonce, and a different nonce on every request", () => {
    const first = run().headers.get("content-security-policy") ?? "";
    const second = run().headers.get("content-security-policy") ?? "";

    expect(nonceOf(first)).toBeTruthy();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });

  it("does not allow inline or eval'd scripts", () => {
    const csp = run().headers.get("content-security-policy") ?? "";
    const scriptSrc = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src")) ?? "";

    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("blocks framing, plugins, base-tag hijacking and off-site connections", () => {
    const csp = run().headers.get("content-security-policy") ?? "";

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("connect-src 'self'");
  });

  it("forwards the same nonce to the app on the request", () => {
    // Next.js exposes middleware request-header overrides as x-middleware-request-* response headers.
    // If a Next.js upgrade renames these, this assertion is the one to revisit.
    const response = run();
    const csp = response.headers.get("content-security-policy") ?? "";

    expect(response.headers.get("x-middleware-request-x-nonce")).toBe(nonceOf(csp));
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });
});