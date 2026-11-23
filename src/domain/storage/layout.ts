import { dataFileSchema, SCHEMA_VERSION, type BalanceEntry, type DataFile } from '../schema';
import type { AccountsFile, BalanceFile, SettingsFile } from './files';
import { ACCOUNTS_FILE, SETTINGS_FILE } from './files';
import { assertValidPeriods, ensureCovered, type Period } from './periods';

/** The data as a set of stored files (ADR-0014). Keys of `balances` are paths like `balances/2025.json`. */
export interface Layout {
  settings: SettingsFile;
  accounts: AccountsFile;
  balances: Record<string, BalanceFile>;
}

const byDateThenId = (a: BalanceEntry, b: BalanceEntry) =>
  a.date.localeCompare(b.date) || a.id.localeCompare(b.id);

/**
 * Split the in-memory data into files. `periods` are the existing file periods (already
 * realigned if the financial year changed); they're extended to cover every balance date.
 */
export function splitDataset(data: DataFile, periods: readonly Period[]): Layout {
  const covered = ensureCovered(
    periods,
    data.balances.map((b) => b.date),
    data.settings.financialYearStartMonth,
  );
  const balances: Record<string, BalanceFile> = {};
  for (const period of covered) {
    balances[period.file] = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: data.updatedAt,
      from: period.from,
      to: period.to,
      balances: data.balances
        .filter((b) => b.date >= period.from && b.date <= period.to)
        .sort(byDateThenId),
    };
  }
  return {
    settings: {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: data.updatedAt,
      baseCurrency: data.baseCurrency,
      settings: data.settings,
      balanceFiles: covered,
    },
    accounts: { schemaVersion: SCHEMA_VERSION, updatedAt: data.updatedAt, accounts: data.accounts },
    balances,
  };
}

export class MissingBalanceFileError extends Error {
  constructor(readonly file: string) {
    super(`A balance file is missing: ${file}`);
    this.name = 'MissingBalanceFileError';
  }
}

/**
 * Put stored files back together. A file only owns entries dated within the period recorded in
 * settings.json, and entries whose account isn't (yet) in accounts.json are ignored: both can
 * appear briefly if a save was interrupted, and the next save tidies them up.
 */
export function assembleDataset(
  settings: SettingsFile,
  accounts: AccountsFile,
  balanceFiles: Readonly<Record<string, BalanceFile | undefined>>,
): DataFile {
  assertValidPeriods(settings.balanceFiles);
  const accountIds = new Set(accounts.accounts.map((a) => a.id));
  const balances: BalanceEntry[] = [];
  for (const period of settings.balanceFiles) {
    const file = balanceFiles[period.file];
    if (!file) throw new MissingBalanceFileError(period.file);
    for (const entry of file.balances) {
      if (entry.date >= period.from && entry.date <= period.to && accountIds.has(entry.accountId)) {
        balances.push(entry);
      }
    }
  }
  const updatedAt = Object.values(balanceFiles).reduce(
    (latest, f) => (f && f.updatedAt > latest ? f.updatedAt : latest),
    settings.updatedAt > accounts.updatedAt ? settings.updatedAt : accounts.updatedAt,
  );
  return dataFileSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    updatedAt,
    baseCurrency: settings.baseCurrency,
    settings: settings.settings,
    accounts: accounts.accounts,
    balances,
  });
}

/** Content identity for change detection: ignores `updatedAt`. */
export function contentKey(file: { updatedAt: string }): string {
  return JSON.stringify({ ...file, updatedAt: '' });
}

export type WriteStep =
  | { kind: 'write'; path: string; content: SettingsFile | AccountsFile | BalanceFile }
  | { kind: 'trash'; path: string };

/**
 * Which files to write, and in what order (ADR-0014), so an interrupted save never shows broken
 * or missing data:
 * 1. balance files that are new, changed, or receive entries from another file;
 * 2. accounts.json;
 * 3. settings.json (from here on, the new periods decide which file owns which entry);
 * 4. balance files that gave entries away to another file (their old copies are ignored once
 *    settings.json no longer assigns those dates to them);
 * 5. balance files no longer listed, moved to the trash.
 * Entries are therefore never removed from their old file before they exist in their new one.
 */
export function planWrites(before: Layout | null, after: Layout): WriteStep[] {
  const changed = (prev: { updatedAt: string } | undefined, next: { updatedAt: string }) =>
    !prev || contentKey(prev) !== contentKey(next);

  const fileOf = (layout: Layout | null) => {
    const map = new Map<string, string>();
    for (const [path, file] of Object.entries(layout?.balances ?? {})) {
      for (const entry of file.balances) map.set(entry.id, path);
    }
    return map;
  };
  const was = fileOf(before);
  const now = fileOf(after);
  const givers = new Set<string>();
  for (const [id, oldPath] of was) {
    const newPath = now.get(id);
    if (newPath && newPath !== oldPath) givers.add(oldPath);
  }

  const balanceSteps = (pick: (path: string) => boolean): WriteStep[] =>
    Object.keys(after.balances)
      .sort()
      .filter((path) => pick(path))
      .filter((path) => changed(before?.balances[path], after.balances[path] as BalanceFile))
      .map((path) => ({ kind: 'write', path, content: after.balances[path] as BalanceFile }));

  const steps: WriteStep[] = [...balanceSteps((path) => !givers.has(path))];
  if (changed(before?.accounts, after.accounts)) {
    steps.push({ kind: 'write', path: ACCOUNTS_FILE, content: after.accounts });
  }
  if (changed(before?.settings, after.settings)) {
    steps.push({ kind: 'write', path: SETTINGS_FILE, content: after.settings });
  }
  steps.push(...balanceSteps((path) => givers.has(path)));
  for (const path of Object.keys(before?.balances ?? {}).sort()) {
    if (!(path in after.balances)) steps.push({ kind: 'trash', path });
  }
  return steps;
}
