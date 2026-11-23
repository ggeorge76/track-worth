import { z } from 'zod';
import { accountSchema, balanceEntrySchema, SCHEMA_VERSION, settingsSchema } from '../schema';

/** Stored file formats in `My Drive/TrackWorth/` since data format v3 (ADR-0014). */

export const SETTINGS_FILE = 'settings.json';
export const ACCOUNTS_FILE = 'accounts.json';
/** The v1/v2 single file, migrated on first load and then moved to Drive's trash. */
export const LEGACY_FILE = 'trackworth-data.json';

const periodSchema = z.object({
  file: z.string().regex(/^balances\/\d{4}\.json$/),
  from: z.iso.date(),
  to: z.iso.date(),
});

export const settingsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: z.iso.datetime(),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/),
  settings: settingsSchema,
  /** Every balance file and the exact period it owns. */
  balanceFiles: z.array(periodSchema),
});

export const accountsFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: z.iso.datetime(),
  accounts: z.array(accountSchema),
});

export const balanceFileSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  updatedAt: z.iso.datetime(),
  /** Informational copy of the period; settings.json is authoritative. */
  from: z.iso.date(),
  to: z.iso.date(),
  balances: z.array(balanceEntrySchema),
});

export type SettingsFile = z.infer<typeof settingsFileSchema>;
export type AccountsFile = z.infer<typeof accountsFileSchema>;
export type BalanceFile = z.infer<typeof balanceFileSchema>;

export type StoredParse<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'newer-version'; schemaVersion: number }
  | { ok: false; reason: 'invalid'; message: string };

/** Parse one stored file, refusing files written by a newer app version. */
export function parseStoredFile<T>(schema: z.ZodType<T>, raw: unknown): StoredParse<T> {
  const version = z.object({ schemaVersion: z.int().positive() }).safeParse(raw);
  if (version.success && version.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'newer-version', schemaVersion: version.data.schemaVersion };
  }
  const result = schema.safeParse(raw);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, reason: 'invalid', message: z.prettifyError(result.error) };
}
