import { dataFileSchema, type Account, type BalanceEntry, type DataFile } from '../schema';

/**
 * Three-way merge for offline sync (ADR-0015): `base` is what this device last synced with Drive,
 * `local` is this device now, `remote` is Drive now.
 *
 * - Balances merge automatically per entry; when both sides changed the same entry, or both
 *   added one for the same account and date, the later `recordedAt` wins.
 * - Accounts are decided per account: changed on one side → that side; changed differently on
 *   both → a question (keep this device's or Drive's), never a field-by-field merge.
 * - Settings (and base currency) are decided as a whole, the same way.
 */

export type Choice = 'local' | 'remote';

export type MergeQuestion =
  | { kind: 'account'; id: string; local: Account | undefined; remote: Account | undefined }
  | { kind: 'settings'; local: SettingsPart; remote: SettingsPart };

export interface SettingsPart {
  baseCurrency: string;
  settings: DataFile['settings'];
}

/** Answers keyed by account id, or `settings`. */
export type Choices = Readonly<Record<string, Choice>>;

export interface MergeResult {
  /** The merged data; for unanswered questions it provisionally keeps Drive's version. */
  data: DataFile;
  /** Conflicts that need the user's choice before uploading. */
  questions: MergeQuestion[];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Generic per-key three-way pick. `undefined` means "absent" (deleted or never existed). */
function pick<T>(base: T | undefined, local: T | undefined, remote: T | undefined) {
  const localChanged = !same(local, base);
  const remoteChanged = !same(remote, base);
  if (!localChanged) return { value: remote, conflict: false };
  if (!remoteChanged || same(local, remote)) return { value: local, conflict: false };
  return { value: undefined, conflict: true };
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

const later = (a: BalanceEntry, b: BalanceEntry) => (b.recordedAt > a.recordedAt ? b : a);

function mergeBalances(base: DataFile, local: DataFile, remote: DataFile): BalanceEntry[] {
  const [b, l, r] = [byId(base.balances), byId(local.balances), byId(remote.balances)];
  const merged: BalanceEntry[] = [];
  for (const id of new Set([...b.keys(), ...l.keys(), ...r.keys()])) {
    const { value, conflict } = pick(b.get(id), l.get(id), r.get(id));
    if (!conflict) {
      if (value) merged.push(value);
      continue;
    }
    const [lv, rv] = [l.get(id), r.get(id)];
    // Changed on one side and removed on the other: keep the change (never lose an edit).
    if (lv && rv) merged.push(later(lv, rv));
    else if (lv ?? rv) merged.push((lv ?? rv) as BalanceEntry);
  }
  // One entry per account per day: if both sides added one, the later-recorded wins (local on a tie).
  const localIds = new Set(l.keys());
  const perDay = new Map<string, BalanceEntry>();
  for (const entry of merged) {
    const key = `${entry.accountId}|${entry.date}`;
    const existing = perDay.get(key);
    if (!existing) perDay.set(key, entry);
    else if (entry.recordedAt > existing.recordedAt) perDay.set(key, entry);
    else if (entry.recordedAt === existing.recordedAt && localIds.has(entry.id))
      perDay.set(key, entry);
  }
  return [...perDay.values()];
}

export function threeWayMerge(
  base: DataFile,
  local: DataFile,
  remote: DataFile,
  choices: Choices = {},
  now: Date = new Date(),
): MergeResult {
  const questions: MergeQuestion[] = [];

  // Accounts, per account. Keep a stable order: remote's order, then local additions.
  const [b, l, r] = [byId(base.accounts), byId(local.accounts), byId(remote.accounts)];
  const order = [
    ...new Set([
      ...remote.accounts.map((a) => a.id),
      ...local.accounts.map((a) => a.id),
      ...b.keys(),
    ]),
  ];
  const accounts: Account[] = [];
  for (const id of order) {
    const { value, conflict } = pick(b.get(id), l.get(id), r.get(id));
    if (!conflict) {
      if (value) accounts.push(value);
      continue;
    }
    const choice = choices[id];
    if (!choice) questions.push({ kind: 'account', id, local: l.get(id), remote: r.get(id) });
    const chosen = choice === 'local' ? l.get(id) : r.get(id);
    if (chosen) accounts.push(chosen);
  }

  // Settings and base currency, as a whole.
  const part = (d: DataFile): SettingsPart => ({
    baseCurrency: d.baseCurrency,
    settings: d.settings,
  });
  const settingsPick = pick(part(base), part(local), part(remote));
  let settings = settingsPick.value ?? part(remote);
  if (settingsPick.conflict) {
    const choice = choices.settings;
    if (!choice) questions.push({ kind: 'settings', local: part(local), remote: part(remote) });
    settings = choice === 'local' ? part(local) : part(remote);
  }

  const accountIds = new Set(accounts.map((a) => a.id));
  const balances = mergeBalances(base, local, remote).filter((e) => accountIds.has(e.accountId));

  const data = dataFileSchema.parse({
    schemaVersion: remote.schemaVersion,
    updatedAt: now.toISOString(),
    baseCurrency: settings.baseCurrency,
    settings: settings.settings,
    accounts,
    balances,
  });
  return { data, questions };
}
