import { describe, expect, it } from "vitest";
import { analyzeVault, OLD_AFTER_DAYS } from "@/lib/passwordHealth";
import { estimatePasswordStrength } from "@/lib/passwordStrength";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-09-20T00:00:00Z");
const ago = (days: number) => new Date(NOW - days * DAY).toISOString();

describe("estimatePasswordStrength", () => {
  it("scores empty as 0 with no label", () => {
    expect(estimatePasswordStrength("")).toEqual({ score: 0, label: "" });
  });

  it("rewards length and variety", () => {
    const short = estimatePasswordStrength("abcdefgh").score;
    const mixed = estimatePasswordStrength("aB3$efgh").score;
    const long = estimatePasswordStrength("aB3$efgh-ijkl-MNOP-9876").score;
    expect(mixed).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(mixed);
  });

  it("penalises repeats and common prefixes, and stays within 0–6", () => {
    expect(estimatePasswordStrength("aaaaaaaaaaaa").score).toBeLessThan(estimatePasswordStrength("kqzmwxvbnplt").score);
    expect(estimatePasswordStrength("Password1!").score).toBeLessThan(estimatePasswordStrength("Xassword1!").score);
    for (const pw of ["", "a", "Xk9#mQ2$vL7!pR4&nT8-long-and-varied"]) {
      const { score } = estimatePasswordStrength(pw);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(6);
    }
  });
});

describe("analyzeVault", () => {
  const strong = "Xk9#mQ2$vL7!pR4&nT8";
  const shared = "Sh4red!Passphrase#77";

  const health = analyzeVault(
    [
      { id: "a", password: strong, updatedAt: ago(10) },
      { id: "b", password: "abc123", updatedAt: ago(10) },
      { id: "c", password: shared, updatedAt: ago(10) },
      { id: "d", password: shared, updatedAt: ago(OLD_AFTER_DAYS + 35) },
      { id: "e", password: "", updatedAt: "not-a-date" },
    ],
    NOW,
  );

  it("leaves a strong, unique, recent password unflagged", () => {
    expect(health.flags.has("a")).toBe(false);
  });

  it("flags weak passwords", () => {
    expect(health.flags.get("b")).toContain("weak");
  });

  it("flags reuse on every entry that shares a password", () => {
    expect(health.flags.get("c")).toContain("reused");
    expect(health.flags.get("d")).toContain("reused");
  });

  it("flags entries not updated for over a year, but not recent ones", () => {
    expect(health.flags.get("d")).toContain("old");
    expect(health.flags.get("c")).not.toContain("old");
  });

  it("copes with an empty password and an unparseable date", () => {
    expect(health.flags.has("e")).toBe(false);
  });

  it("counts flags, and scores the share of clean entries", () => {
    expect(health.counts).toEqual({ weak: 1, reused: 2, old: 1 });
    expect(health.total).toBe(5);
    expect(health.flagged).toBe(3);
    expect(health.score).toBe(40);
  });

  it("scores an empty vault as 100", () => {
    expect(analyzeVault([]).score).toBe(100);
  });

  it("does not treat empty passwords as reused", () => {
    const result = analyzeVault(
      [
        { id: "x", password: "", updatedAt: ago(1) },
        { id: "y", password: "", updatedAt: ago(1) },
      ],
      NOW,
    );
    expect(result.counts.reused).toBe(0);
  });
});