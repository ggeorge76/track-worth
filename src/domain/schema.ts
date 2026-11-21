import { z } from 'zod';

/**
 * Data file schema (ADR-0006). This is the contract with the JSON stored in the user's Drive.
 *
 * Rules:
 * - Any change to the shape needs a new SCHEMA_VERSION and a migration in migrations.ts.
 * - Never remove or rename a field without a migration; old files must keep loading.
 * - Money is always stored as integer minor units (cents) + ISO 4217 currency code.
 */
export const SCHEMA_VERSION = 1;

const id = z.string().min(1).max(64);
const currencyCode = z.string().regex(/^[A-Z]{3}$/, 'Expected an ISO 4217 code like "USD"');

export const accountKindSchema = z.enum(['asset', 'liability']);

export const accountCategorySchema = z.enum([
  'cash',
  'bank',
  'investment',
  'retirement',
  'property',
  'vehicle',
  'crypto',
  'other_asset',
  'credit_card',
  'loan',
  'mortgage',
  'other_liability',
]);

export const accountSchema = z.object({
  id,
  name: z.string().trim().min(1).max(100),
  kind: accountKindSchema,
  category: accountCategorySchema,
  currency: currencyCode,
  archived: z.boolean(),
  note: z.string().max(1000).optional(),
  createdAt: z.iso.datetime(),
});

/**
 * One manually entered balance for an account on a given date.
 * For liabilities, amountMinor is the amount owed as a positive number.
 */
export const balanceEntrySchema = z.object({
  id,
  accountId: id,
  date: z.iso.date(),
  amountMinor: z.int(),
  note: z.string().max(500).optional(),
  recordedAt: z.iso.datetime(),
});

export const dataFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: z.iso.datetime(),
  baseCurrency: currencyCode,
  accounts: z.array(accountSchema),
  balances: z.array(balanceEntrySchema),
});

export type AccountKind = z.infer<typeof accountKindSchema>;
export type AccountCategory = z.infer<typeof accountCategorySchema>;
export type Account = z.infer<typeof accountSchema>;
export type BalanceEntry = z.infer<typeof balanceEntrySchema>;
export type DataFile = z.infer<typeof dataFileSchema>;

export type ParseResult =
  | { ok: true; data: DataFile }
  | { ok: false; reason: 'newer-version'; schemaVersion: number }
  | { ok: false; reason: 'invalid'; message: string };

/**
 * Validate raw JSON from Drive. A file written by a newer app version is rejected
 * (rather than parsed and silently stripped) so we never overwrite data we don't understand.
 */
export function parseDataFile(raw: unknown): ParseResult {
  const version = z.object({ schemaVersion: z.int().positive() }).safeParse(raw);
  if (version.success && version.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'newer-version', schemaVersion: version.data.schemaVersion };
  }
  const result = dataFileSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, reason: 'invalid', message: z.prettifyError(result.error) };
  }
  return { ok: true, data: result.data };
}

export function createEmptyDataFile(baseCurrency: string, now: Date = new Date()): DataFile {
  return dataFileSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now.toISOString(),
    baseCurrency,
    accounts: [],
    balances: [],
  });
}
