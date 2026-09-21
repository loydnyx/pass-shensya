import { describe, expect, it } from "vitest";
import {
  buildVaultFieldAad,
  decryptField,
  deriveKeyFromSecret,
  encryptField,
  generatePassword,
  generateRecoveryKey,
  generateSaltHex,
  generateVaultKey,
  unwrapKey,
  wrapKey,
} from "@/lib/crypto";
import { normalizeEmail, normalizeRecoveryKey } from "@/lib/format";

describe("AES-256-GCM field encryption", () => {
  const key = generateVaultKey();
  const aad = buildVaultFieldAad("user-1", "entry-1", "password");

  it("round-trips and uses the versioned format", () => {
    const stored = encryptField("hunter2 & ünïcode ✓", key, aad);
    expect(stored.startsWith("v2:")).toBe(true);
    expect(decryptField(stored, key, aad)).toBe("hunter2 & ünïcode ✓");
  });

  it("never encrypts the same value the same way twice (random IV)", () => {
    expect(encryptField("same", key, aad)).not.toBe(encryptField("same", key, aad));
  });

  it("does not contain the plaintext", () => {
    expect(encryptField("super-secret-value", key, aad)).not.toContain("super-secret-value");
  });

  it("rejects the wrong key", () => {
    const stored = encryptField("x", key, aad);
    expect(() => decryptField(stored, generateVaultKey(), aad)).toThrow("Decryption failed");
  });

  it("rejects the wrong AAD (ciphertext is bound to user, entry and field)", () => {
    const stored = encryptField("x", key, aad);
    expect(() => decryptField(stored, key, buildVaultFieldAad("user-1", "entry-2", "password"))).toThrow(
      "Decryption failed",
    );
    expect(() => decryptField(stored, key, buildVaultFieldAad("user-1", "entry-1", "username"))).toThrow(
      "Decryption failed",
    );
    expect(() => decryptField(stored, key)).toThrow("Decryption failed");
  });

  it("detects tampering with the ciphertext or the auth tag", () => {
    const stored = encryptField("x", key, aad);
    const raw = Buffer.from(stored.slice(3), "base64");

    for (const index of [0, 13, raw.length - 1]) {
      const tampered = Buffer.from(raw);
      tampered[index] ^= 0x01;
      expect(() => decryptField(`v2:${tampered.toString("base64")}`, key, aad)).toThrow(
        "Decryption failed",
      );
    }
  });

  it("gives one generic error for malformed input, and refuses wrong key sizes", () => {
    expect(() => decryptField("v1:abc", key, aad)).toThrow("Unsupported or malformed ciphertext");
    expect(() => decryptField("v2:AAAA", key, aad)).toThrow("Malformed ciphertext");
    expect(() => encryptField("x", Buffer.alloc(16), aad)).toThrow("Invalid encryption key length");
  });
});

describe("key derivation and key wrapping", () => {
  it("derives the same key for the same secret and salt, and different keys otherwise", async () => {
    const salt = generateSaltHex();
    const a = await deriveKeyFromSecret("correct horse", salt);
    const b = await deriveKeyFromSecret("correct horse", salt);
    const otherSalt = await deriveKeyFromSecret("correct horse", generateSaltHex());
    const otherSecret = await deriveKeyFromSecret("correct horsf", salt);

    expect(a.length).toBe(32);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(otherSalt)).toBe(false);
    expect(a.equals(otherSecret)).toBe(false);
  });

  it("rejects a malformed salt", async () => {
    await expect(deriveKeyFromSecret("x", "not-hex")).rejects.toThrow("Invalid salt");
  });

  it("wraps and unwraps the same vault key", async () => {
    const vaultKey = generateVaultKey();
    const kek = await deriveKeyFromSecret("pw", generateSaltHex());
    expect(unwrapKey(wrapKey(vaultKey, kek, "password"), kek, "password").equals(vaultKey)).toBe(true);
  });

  it("will not unwrap under the wrong secret or the wrong purpose", async () => {
    const vaultKey = generateVaultKey();
    const kek = await deriveKeyFromSecret("pw", generateSaltHex());
    const wrapped = wrapKey(vaultKey, kek, "password");

    // A "password" copy cannot be swapped into the "recovery" slot.
    expect(() => unwrapKey(wrapped, kek, "recovery")).toThrow();
    expect(() => unwrapKey(wrapped, generateVaultKey(), "password")).toThrow();
  });
});

describe("recovery key", () => {
  it("has 128 bits of entropy in grouped hex, and is unique", () => {
    const key = generateRecoveryKey();
    expect(key).toMatch(/^([0-9A-F]{4}-){7}[0-9A-F]{4}$/);
    expect(generateRecoveryKey()).not.toBe(key);
  });

  it("normalizeRecoveryKey tolerates spacing, dashes and case", () => {
    const key = generateRecoveryKey();
    expect(normalizeRecoveryKey(key.toLowerCase())).toBe(key);
    expect(normalizeRecoveryKey(key.replace(/-/g, " "))).toBe(key);
    expect(normalizeRecoveryKey(`  ${key.replace(/-/g, "")}  `)).toBe(key);
  });

  it("normalizeRecoveryKey returns null instead of throwing on bad input", () => {
    expect(normalizeRecoveryKey("")).toBeNull();
    expect(normalizeRecoveryKey("nope")).toBeNull();
    expect(normalizeRecoveryKey("G".repeat(32))).toBeNull();
    expect(normalizeRecoveryKey(undefined as unknown as string)).toBeNull();
  });
});

describe("helpers", () => {
  it("normalizeEmail trims and lowercases", () => {
    expect(normalizeEmail("  Jane@Example.COM ")).toBe("jane@example.com");
  });

  it("generatePassword honours length and avoids look-alike characters", () => {
    const password = generatePassword(64);
    expect(password).toHaveLength(64);
    expect(password).not.toMatch(/[0O1lI]/);
  });

  it("generatePassword can leave out symbols", () => {
    expect(generatePassword(200, { symbols: false })).toMatch(/^[A-Za-z0-9]+$/);
  });
});