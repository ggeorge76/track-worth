import { dataFileSchema, type AccountKind, type BalanceEntry, type DataFile } from './schema';
import type { ChangeOptions } from './accounts';

export type Sign = 'positive' | 'negative';

/** Assets default to positive balances, liabilities to negative. */
export function defaultSign(kind: AccountKind): Sign {
  return kind === 'asset' ? 'positive' : 'negative';
}

/** Combine a user-entered magnitude (always typed as positive) with the chosen sign. */
export function signedAmount(magnitudeMinor: number, sign: Sign): number {
  const magnitude = Math.abs(magnitudeMinor);
  return sign === 'negative' && magnitude !== 0 ? -magnitude : magnitude;
}

export function signOf(amountMinor: number): Sign {
  return amountMinor < 0 ? 'negative' : 'positive';
}

/** An account's entries, newest first (same-day ties: most recently recorded first). */
export function accountHistory(
  balances: readonly BalanceEntry[],
  accountId: string,
): BalanceEntry[] {
  return balances
    .filter((b) => b.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));
}

export interface BalanceInput {
  accountId: string;
  date: string;
  amountMinor: number;
}

/**
 * Record a balance. If the account already has an entry on that date, that entry is updated
 * instead of adding a second one (requirement R-B5).
 */
export function upsertBalance(
  data: DataFile,
  input: BalanceInput,
  { now, newId }: ChangeOptions,
): DataFile {
  if (!data.accounts.some((a) => a.id === input.accountId)) {
    throw new Error(`Unknown account ${input.accountId}`);
  }
  const recordedAt = now.toISOString();
  const existing = data.balances.find(
    (b) => b.accountId === input.accountId && b.date === input.date,
  );
  const balances = existing
    ? data.balances.map((b) =>
        b === existing ? { ...b, amountMinor: input.amountMinor, recordedAt } : b,
      )
    : [
        ...data.balances,
        {
          id: newId(),
          accountId: input.accountId,
          date: input.date,
          amountMinor: input.amountMinor,
          recordedAt,
        },
      ];
  return dataFileSchema.parse({ ...data, balances });
}

/**
 * True when every entry has the sign this type defaults to, i.e. the balances were probably
 * entered with the default. Used to pre-tick "flip signs" when the type is changed.
 */
export function allEntriesHaveDefaultSign(
  entries: readonly BalanceEntry[],
  kind: AccountKind,
): boolean {
  const expected = defaultSign(kind);
  return entries.every((e) => e.amountMinor === 0 || signOf(e.amountMinor) === expected);
}

/** Remove one balance entry. */
export function deleteBalance(data: DataFile, entryId: string): DataFile {
  if (!data.balances.some((b) => b.id === entryId)) throw new Error(`Unknown balance ${entryId}`);
  return dataFileSchema.parse({ ...data, balances: data.balances.filter((b) => b.id !== entryId) });
}

/**
 * Put a deleted entry back (undo). If its account is gone, it isn't restored. If another entry now
 * exists for that account and date, that newer entry is kept.
 */
export function restoreBalance(data: DataFile, entry: BalanceEntry): DataFile {
  const accountExists = data.accounts.some((a) => a.id === entry.accountId);
  const taken = data.balances.some(
    (b) => b.id === entry.id || (b.accountId === entry.accountId && b.date === entry.date),
  );
  if (!accountExists || taken) return data;
  return dataFileSchema.parse({ ...data, balances: [...data.balances, entry] });
}
