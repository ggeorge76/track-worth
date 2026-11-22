/** Builders for made-up test data. Only imported by tests. */
import type { Account, BalanceEntry, DataFile } from '@/domain/schema';
import { createEmptyDataFile } from '@/domain/schema';

export const NOW = new Date('2026-11-22T10:00:00.000Z');

export function makeAccount(over: Partial<Account> = {}): Account {
  return {
    id: 'a',
    name: 'Account',
    kind: 'asset',
    tag: 'Cash',
    liquidity: 3,
    currency: 'USD',
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

let seq = 0;
export function makeEntry(over: Partial<BalanceEntry> = {}): BalanceEntry {
  seq += 1;
  return {
    id: `e${String(seq)}`,
    accountId: 'a',
    date: '2026-01-01',
    amountMinor: 0,
    recordedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function makeFile(over: Partial<DataFile> = {}): DataFile {
  return { ...createEmptyDataFile('USD', NOW), ...over };
}

/** Deterministic id generator for change functions. */
export function idSequence(prefix = 'id') {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}-${String(n)}`;
  };
}
