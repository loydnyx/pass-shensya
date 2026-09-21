import { randomUUID } from "node:crypto";

/**
 * In-memory stand-in for the Prisma client, used by the route tests so they
 * need no database. It mimics the Prisma behaviours the app relies on:
 * `createdAt` is set once by the database, `@updatedAt` moves on every update,
 * and deleting a user cascades to their vault entries.
 */

export type UserRow = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  vaultSalt: string;
  vaultKeyWrapped: string;
  recoverySalt: string;
  recoveryKeyWrapped: string;
  createdAt: Date;
};

export type VaultRow = {
  id: string;
  userId: string;
  label: string;
  category: string;
  websiteUrl: string | null;
  usernameCipher: string;
  passwordCipher: string;
  notesCipher: string | null;
  favorite: boolean;
  cryptoVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

export const users = new Map<string, UserRow>();
export const entries = new Map<string, VaultRow>();

/** Stands in for Prisma.PrismaClientKnownRequestError (unique-constraint race in signup). */
export class FakeKnownError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export function resetDb() {
  users.clear();
  entries.clear();
}

type UserWhere = { id?: string; email?: string };
type EntryWhere = { id?: string; userId?: string };

const matchesEntry = (row: VaultRow, where: EntryWhere) =>
  (where.id === undefined || row.id === where.id) &&
  (where.userId === undefined || row.userId === where.userId);

export const prisma = {
  user: {
    async findUnique({ where }: { where: UserWhere }) {
      for (const user of users.values()) {
        if (where.id !== undefined && user.id === where.id) return { ...user };
        if (where.email !== undefined && user.email === where.email) return { ...user };
      }
      return null;
    },

    async create({ data }: { data: Omit<UserRow, "id" | "createdAt"> }) {
      for (const user of users.values()) {
        if (user.email === data.email) throw new FakeKnownError("P2002");
      }
      const row: UserRow = { ...data, id: randomUUID(), createdAt: new Date() };
      users.set(row.id, row);
      return { ...row };
    },

    async update({ where, data }: { where: { id: string }; data: Partial<UserRow> }) {
      const row = users.get(where.id);
      if (!row) throw new Error("Record not found");
      const next = { ...row, ...data };
      users.set(row.id, next);
      return { ...next };
    },

    async delete({ where }: { where: { id: string } }) {
      const row = users.get(where.id);
      if (!row) throw new Error("Record not found");
      users.delete(where.id);
      for (const [id, entry] of entries) {
        if (entry.userId === where.id) entries.delete(id); // onDelete: Cascade
      }
      return { ...row };
    },
  },

  vaultEntry: {
    async findMany({ where }: { where: EntryWhere; orderBy?: unknown }) {
      return [...entries.values()]
        .filter((row) => matchesEntry(row, where))
        .sort(
          (a, b) =>
            Number(b.favorite) - Number(a.favorite) || a.label.localeCompare(b.label),
        )
        .map((row) => ({ ...row }));
    },

    async create({ data }: { data: Omit<VaultRow, "createdAt" | "updatedAt" | "cryptoVersion"> }) {
      const now = new Date();
      const row: VaultRow = { cryptoVersion: 2, ...data, createdAt: now, updatedAt: now };
      entries.set(row.id, row);
      return { ...row };
    },

    async updateMany({ where, data }: { where: EntryWhere; data: Partial<VaultRow> }) {
      let count = 0;
      for (const [id, row] of entries) {
        if (!matchesEntry(row, where)) continue;
        // createdAt is never touched; updatedAt moves (Prisma's @updatedAt).
        entries.set(id, { ...row, ...data, updatedAt: new Date() });
        count += 1;
      }
      return { count };
    },

    async deleteMany({ where }: { where: EntryWhere }) {
      let count = 0;
      for (const [id, row] of entries) {
        if (matchesEntry(row, where)) {
          entries.delete(id);
          count += 1;
        }
      }
      return { count };
    },
  },
};