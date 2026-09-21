import { describe, expect, it } from "vitest";
import { loginSchema, recoverySchema, signupSchema, vaultEntrySchema } from "@/lib/validation";

const LONG_ENOUGH = "a passphrase of 14+";

describe("signupSchema", () => {
  it("accepts a valid signup and trims the display name and email", () => {
    const parsed = signupSchema.parse({
      displayName: "  Jane  ",
      email: "  jane@example.com ",
      password: LONG_ENOUGH,
    });
    expect(parsed.displayName).toBe("Jane");
    expect(parsed.email).toBe("jane@example.com");
  });

  it("requires a master password of at least 14 characters", () => {
    const result = signupSchema.safeParse({ displayName: "Jane", email: "j@e.co", password: "x".repeat(13) });
    expect(result.success).toBe(false);
    expect(signupSchema.safeParse({ displayName: "Jane", email: "j@e.co", password: "x".repeat(14) }).success).toBe(true);
  });

  it("never alters the password the user typed (no trim, no case change)", () => {
    const typed = "  Mixed Case With  Spaces  ";
    expect(signupSchema.parse({ displayName: "Jane", email: "j@e.co", password: typed }).password).toBe(typed);
  });

  it("rejects a bad email or a one-letter name", () => {
    expect(signupSchema.safeParse({ displayName: "Jane", email: "nope", password: LONG_ENOUGH }).success).toBe(false);
    expect(signupSchema.safeParse({ displayName: "J", email: "j@e.co", password: LONG_ENOUGH }).success).toBe(false);
  });
});

describe("loginSchema and recoverySchema", () => {
  it("login needs an email and a non-empty password", () => {
    expect(loginSchema.safeParse({ email: "j@e.co", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "j@e.co", password: "x" }).success).toBe(true);
  });

  it("recovery enforces the same minimum length for the new password", () => {
    expect(recoverySchema.safeParse({ email: "j@e.co", recoveryKey: "k", newPassword: "short" }).success).toBe(false);
    expect(recoverySchema.safeParse({ email: "j@e.co", recoveryKey: "k", newPassword: LONG_ENOUGH }).success).toBe(true);
  });
});

describe("vaultEntrySchema", () => {
  it("applies defaults", () => {
    const parsed = vaultEntrySchema.parse({ label: "GitHub", password: "pw" });
    expect(parsed.category).toBe("General");
    expect(parsed.username).toBe("");
  });

  it("drops fields the browser must not control (createdAt, updatedAt, userId, id)", () => {
    const parsed = vaultEntrySchema.parse({
      label: "GitHub",
      password: "pw",
      createdAt: "2000-01-01T00:00:00.000Z",
      updatedAt: "2000-01-01T00:00:00.000Z",
      userId: "someone-else",
      id: "chosen-by-attacker",
    }) as Record<string, unknown>;

    for (const key of ["createdAt", "updatedAt", "userId", "id"]) {
      expect(parsed).not.toHaveProperty(key);
    }
  });

  it("enforces length limits and a valid URL", () => {
    expect(vaultEntrySchema.safeParse({ label: "", password: "pw" }).success).toBe(false);
    expect(vaultEntrySchema.safeParse({ label: "x".repeat(81), password: "pw" }).success).toBe(false);
    expect(vaultEntrySchema.safeParse({ label: "ok", password: "pw", websiteUrl: "not a url" }).success).toBe(false);
    expect(vaultEntrySchema.safeParse({ label: "ok", password: "pw", websiteUrl: "" }).success).toBe(true);
  });
});