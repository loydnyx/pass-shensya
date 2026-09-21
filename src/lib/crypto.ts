import { randomBytes, randomInt, scrypt as scryptCb, createCipheriv, createDecipheriv } from "crypto";

// A hand-rolled Promise wrapper (rather than util.promisify) so TypeScript
// keeps the 4-argument overload of scrypt that takes explicit options —
// promisify's inferred type collapses to the 3-argument overload and
// rejects the options object.
function scryptWithOptions(
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// --- scrypt key-derivation parameters, explicit rather than relying on
// Node's defaults. Tuned for a normal Next.js server process — costly
// enough to slow down offline guessing, cheap enough not to choke a
// request under normal load. Re-benchmark on your actual deployment
// hardware if login/signup latency becomes noticeable.
export const SCRYPT_N = 32768;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
export const SCRYPT_KEYLEN = 32;
export const SCRYPT_MAXMEM = 64 * 1024 * 1024; // 64 MB

const AES_KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12; // GCM standard nonce size
const TAG_LENGTH = 16;
const CIPHERTEXT_VERSION = "v2";

/**
 * Derives a key-encryption key (KEK) from a secret (the master password, or
 * the recovery key) plus a random salt, using scrypt with explicit,
 * named cost parameters. The secret itself is never stored — only this
 * derived key (transiently, to wrap/unwrap the vault key) and the salt (in
 * the database) exist.
 */
export async function deriveKeyFromSecret(secret: string, saltHex: string): Promise<Buffer> {
  if (!/^[0-9a-fA-F]{32}$/.test(saltHex)) {
    throw new Error("Invalid salt");
  }
  const salt = Buffer.from(saltHex, "hex");
  const key = await scryptWithOptions(secret, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return key;
}

export function generateSaltHex(): string {
  return randomBytes(16).toString("hex");
}

/** A random 256-bit vault key — never derived from the password, only wrapped by it. */
export function generateVaultKey(): Buffer {
  return randomBytes(AES_KEY_LENGTH);
}

/**
 * Encrypts a plaintext string with AES-256-GCM into a versioned, structured
 * format: "v2:<base64(iv || tag || ciphertext)>". Optional AAD (additional
 * authenticated data) binds the ciphertext to its intended context — e.g.
 * which user, which entry, which field — so it is authenticated but never
 * itself encrypted, and must never contain secrets.
 */
export function encryptField(plaintext: string, key: Buffer, aad?: string): string {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error("Invalid encryption key length");
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (aad) cipher.setAAD(Buffer.from(aad, "utf8"));
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, tag, encrypted]).toString("base64");
  return `${CIPHERTEXT_VERSION}:${payload}`;
}

/**
 * Decrypts a value produced by encryptField. Throws a single generic error
 * for every failure mode — wrong key, wrong/missing AAD, tampered
 * ciphertext, tampered auth tag, malformed or unsupported input — so
 * callers (and attackers) can't use the error itself as an oracle.
 */
export function decryptField(stored: string, key: Buffer, aad?: string): string {
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error("Invalid decryption key length");
  }
  const prefix = `${CIPHERTEXT_VERSION}:`;
  if (typeof stored !== "string" || !stored.startsWith(prefix)) {
    throw new Error("Unsupported or malformed ciphertext");
  }

  const raw = Buffer.from(stored.slice(prefix.length), "base64");
  if (raw.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error("Malformed ciphertext");
  }

  const iv = raw.subarray(0, IV_LENGTH);
  const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH + TAG_LENGTH);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    if (aad) decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error("Decryption failed");
  }
}

/** Wraps a raw key (the vault key) under a KEK, bound to a purpose via AAD (e.g. "password" vs "recovery"). */
export function wrapKey(rawKey: Buffer, kek: Buffer, context: string): string {
  return encryptField(rawKey.toString("hex"), kek, `pass-shensya:v2:keywrap:${context}`);
}

/** Unwraps a key wrapped by wrapKey. Throws if the KEK or context is wrong. */
export function unwrapKey(wrapped: string, kek: Buffer, context: string): Buffer {
  const hex = decryptField(wrapped, kek, `pass-shensya:v2:keywrap:${context}`);
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== AES_KEY_LENGTH) {
    throw new Error("Unwrapped key has unexpected length");
  }
  return buf;
}

/** AAD for a vault entry field — binds ciphertext to exactly which user/entry/field it belongs to. */
export function buildVaultFieldAad(
  userId: string,
  entryId: string,
  field: "username" | "password" | "notes"
): string {
  return `pass-shensya:v2:${userId}:${entryId}:${field}`;
}

const RECOVERY_KEY_BYTES = 16; // 128 bits of entropy

/** A human-typeable, high-entropy recovery key: 16 random bytes as grouped hex, "XXXX-XXXX-...". */
export function generateRecoveryKey(): string {
  const raw = randomBytes(RECOVERY_KEY_BYTES).toString("hex").toUpperCase();
  const groups = raw.match(/.{4}/g);
  return groups ? groups.join("-") : raw; // raw is always a multiple of 4 hex chars
}

/** Generates a password with no modulo bias — uses randomInt's rejection sampling, never `bytes[i] % n`. */
export function generatePassword(length = 20, options?: { symbols?: boolean }): string {
  const lowers = "abcdefghijkmnopqrstuvwxyz";
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}";
  let charset = lowers + uppers + digits;
  if (options?.symbols !== false) charset += symbols;

  let out = "";
  for (let i = 0; i < length; i++) {
    out += charset[randomInt(charset.length)];
  }
  return out;
}