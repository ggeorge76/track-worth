import { z } from 'zod';
import {
  accountSchema,
  balanceEntrySchema,
  historyPointSchema,
  SCHEMA_VERSION,
  settingsSchema,
} from '../schema';

/**
 * Stored file formats in `My Drive/TrackWorth/` since data format v3 (ADR-0014). v4 only added
 * `netWorthHistory` to settings.json (ADR-0017); v3 files are still read (see `parseStoredFile`)
 * and are written as v4 the next time they change.
 */

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
  /** Earlier monthly net-worth totals (ADR-0017). */
  netWorthHistory: z.array(historyPointSchema),
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

/**
 * A v3 stored file as v4: same shape, plus an empty `netWorthHistory` for settings.json (the
 * only file whose shape changed). Other values pass through unchanged.
 */
function fromV3(raw: unknown): unknown {
  const v3 = z.looseObject({ schemaVersion: z.literal(3) }).safeParse(raw);
  if (!v3.success) return raw;
  const upgraded: Record<string, unknown> = { ...v3.data, schemaVersion: SCHEMA_VERSION };
  if ('balanceFiles' in upgraded) upgraded.netWorthHistory = [];
  return upgraded;
}

/** Parse one stored file, refusing files written by a newer app version. */
export function parseStoredFile<T>(schema: z.ZodType<T>, raw: unknown): StoredParse<T> {
  const version = z.object({ schemaVersion: z.int().positive() }).safeParse(raw);
  if (version.success && version.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, reason: 'newer-version', schemaVersion: version.data.schemaVersion };
  }
  const result = schema.safeParse(fromV3(raw));
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, reason: 'invalid', message: z.prettifyError(result.error) };
}
