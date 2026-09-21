import { z } from "zod";

const MIN_MASTER_PASSWORD_LENGTH = 14;

// The exact password the user types must reach bcrypt/scrypt unmodified —
// no trim, no case change, no normalization — so a passphrase with meaningful
// spaces or mixed case stays exactly what the user chose.
export const signupSchema = z.object({
  displayName: z.string().trim().min(2, "Name is too short").max(60),
  email: z.string().trim().email("Enter a valid email address"),
  password: z
    .string()
    .min(MIN_MASTER_PASSWORD_LENGTH, `Master password must be at least ${MIN_MASTER_PASSWORD_LENGTH} characters`),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1, "Password is required"),
});

export const recoverySchema = z.object({
  email: z.string().trim().email(),
  recoveryKey: z.string().min(1, "Enter your recovery key"),
  newPassword: z
    .string()
    .min(MIN_MASTER_PASSWORD_LENGTH, `New password must be at least ${MIN_MASTER_PASSWORD_LENGTH} characters`),
});

export const vaultEntrySchema = z.object({
  label: z.string().min(1, "Give this entry a name").max(80),
  category: z.string().min(1).max(40).default("General"),
  websiteUrl: z.string().url().max(2000).optional().or(z.literal("")),
  username: z.string().max(200).default(""),
  password: z.string().max(500),
  notes: z.string().max(2000).optional().or(z.literal("")),
  favorite: z.boolean().optional(),
});