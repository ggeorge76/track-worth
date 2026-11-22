import { z } from 'zod';
import { dataFileV1Schema } from './migrations/v1';
import { migrateV1ToV2 } from './migrations/v1ToV2';
import { DEFAULT_FINANCIAL_YEAR_START_MONTH } from './settings';

/**
 * Data file schema (ADR-0006). This is the contract with the JSON stored in the user's Drive.
 *
 * Rules:
 * - Any change to the shape needs a new SCHEMA_VERSION, a frozen copy of the old schema in
 *   migrations/, a migration step, and a fixture test.
 * - Never remove or rename a field without a migration; old files must keep loading.
 * - Money is always stored as integer minor units (cents) + ISO 4217 currency code.
 */
export const SCHEMA_VERSION = 2;

const id = z.string().min(1).max(64);
const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Expected an ISO 4217 code like "USD"');

export const accountKindSchema = z.enum(['asset', 'liability']);

/** Free text, emoji allowed. One tag per account, used like a category. */
export const tagSchema = z.string().trim().min(1).max(40);

/** 1 = low liquidity (hard to turn into cash) … 5 = high (cash-like). */
export const liquiditySchema = z.int().min(1).max(5);

export const accountSchema = z.object({
  id,
  /** Free text, emoji allowed. */
  name: z.string().trim().min(1).max(100),
  kind: accountKindSchema,
  tag: tagSchema,
  liquidity: liquiditySchema,
  currency: currencyCode,
  /**
   * Where the balance is read from (e.g. "HDFC NetBanking"). Used to order accounts so that all
   * accounts from one source are consecutive when updating balances.
   */
  balanceSource: z.string().trim().min(1).max(60).optional(),
  archived: z.boolean(),
  /** Notes. Free text. */
  note: z.string().max(2000).optional(),
  createdAt: z.iso.datetime(),
});

/**
 * One manually entered balance for an account on a given date.
 * `amountMinor` is signed: liabilities are normally negative (e.g. a loan of 5,000.00 is -500000).
 * Net worth is the plain sum of current balances.
 */
export const balanceEntrySchema = z.object({
  id,
  accountId: id,
  date: z.iso.date(),
  amountMinor: z.int(),
  note: z.string().max(500).optional(),
  /** When the entry was created or last changed. */
  recordedAt: z.iso.datetime(),
});

export const settingsSchema = z.object({
  /** 1 = January … 12 = December. Financial year runs from this month for 12 months. */
  financialYearStartMonth: z.int().min(1).max(12),
  /** Tags the user added, in addition to the built-in defaults (see domain/tags.ts). */
  customTags: z.array(tagSchema),
});

export const dataFileSchema = z
  .object({
    schemaVersion: z.literal(SCHEMA_VERSION),
    updatedAt: z.iso.datetime(),
    baseCurrency: currencyCode,
    settings: settingsSchema,
    accounts: z.array(accountSchema),
    balances: z.array(balanceEntrySchema),
  })
  .superRefine((file, ctx) => {
    const accountIds = new Set<string>();
    for (const account of file.accounts) {
      if (accountIds.has(account.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate account id ${account.id}` });
      }
      accountIds.add(account.id);
    }
    const entryIds = new Set<string>();
    const accountDays = new Set<string>();
    for (const entry of file.balances) {
      if (entryIds.has(entry.id)) {
        ctx.addIssue({ code: 'custom', message: `Duplicate balance id ${entry.id}` });
      }
      entryIds.add(entry.id);
      if (!accountIds.has(entry.accountId)) {
        ctx.addIssue({ code: 'custom', message: `Balance ${entry.id} has no account` });
      }
      const day = `${entry.accountId}|${entry.date}`;
      if (accountDays.has(day)) {
        ctx.addIssue({
          code: 'custom',
          message: `More than one balance for account ${entry.accountId} on ${entry.date}`,
        });
      }
      accountDays.add(day);
    }
  });

export type AccountKind = z.infer<typeof accountKindSchema>;
export type Account = z.infer<typeof accountSchema>;
export type BalanceEntry = z.infer<typeof balanceEntrySchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type DataFile = z.infer<typeof dataFileSchema>;

export type ParseResult =
  | { ok: true; data: DataFile; migratedFrom?: number }
  | { ok: false; reason: 'newer-version'; schemaVersion: number }
  | { ok: false; reason: 'invalid'; message: string };

/** Each step validates its input with the frozen old schema and returns the next version. */
const MIGRATIONS: Record<number, (raw: unknown) => unknown> = {
  1: (raw) => migrateV1ToV2(dataFileV1Schema.parse(raw)),
};

/**
 * Validate raw JSON from Drive, migrating older versions first. A file written by a newer app
 * version is rejected (rather than parsed and silently stripped) so we never overwrite data we
 * don't understand.
 */
export function parseDataFile(raw: unknown): ParseResult {
  const version = z.object({ schemaVersion: z.int().positive() }).safeParse(raw);
  if (!version.success) {
    return { ok: false, reason: 'invalid', message: 'Missing or invalid schemaVersion' };
  }
  const from = version.data.schemaVersion;
  if (from > SCHEMA_VERSION) {
    return { ok: false, reason: 'newer-version', schemaVersion: from };
  }

  let current: unknown = raw;
  try {
    for (let v = from; v < SCHEMA_VERSION; v++) {
      const step = MIGRATIONS[v];
      if (!step) return { ok: false, reason: 'invalid', message: `No migration from v${v}` };
      current = step(current);
    }
  } catch (err) {
    const message = err instanceof z.ZodError ? z.prettifyError(err) : String(err);
    return { ok: false, reason: 'invalid', message };
  }

  const result = dataFileSchema.safeParse(current);
  if (!result.success) {
    return { ok: false, reason: 'invalid', message: z.prettifyError(result.error) };
  }
  return from < SCHEMA_VERSION
    ? { ok: true, data: result.data, migratedFrom: from }
    : { ok: true, data: result.data };
}

export function createEmptyDataFile(baseCurrency: string, now: Date = new Date()): DataFile {
  return dataFileSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    baseCurrency,
    settings: { financialYearStartMonth: DEFAULT_FINANCIAL_YEAR_START_MONTH, customTags: [] },
    accounts: [],
    balances: [],
  });
}
