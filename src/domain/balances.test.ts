import { idSequence, makeAccount, makeEntry, makeFile, NOW } from '@/test/builders';
import {
  accountHistory,
  allEntriesHaveDefaultSign,
  deleteBalance,
  defaultSign,
  recordBalances,
  signedAmount,
  signOf,
  restoreBalance,
  upsertBalance,
} from './balances';

describe('signs', () => {
  it('defaults by account type', () => {
    expect(defaultSign('asset')).toBe('positive');
    expect(defaultSign('liability')).toBe('negative');
  });

  it('applies the chosen sign to a magnitude', () => {
    expect(signedAmount(500, 'positive')).toBe(500);
    expect(signedAmount(500, 'negative')).toBe(-500);
    expect(signedAmount(-500, 'positive')).toBe(500);
    expect(Object.is(signedAmount(0, 'negative'), 0)).toBe(true);
    expect(signOf(-1)).toBe('negative');
    expect(signOf(0)).toBe('positive');
  });
});

describe('upsertBalance', () => {
  const file = makeFile({
    accounts: [makeAccount({ id: 'a' })],
    balances: [makeEntry({ id: 'old', accountId: 'a', date: '2026-11-01', amountMinor: 100 })],
  });
  const opts = () => ({ now: NOW, newId: idSequence('bal') });

  it('adds an entry for a new date', () => {
    const next = upsertBalance(
      file,
      { accountId: 'a', date: '2026-11-22', amountMinor: 250 },
      opts(),
    );
    expect(next.balances).toHaveLength(2);
    expect(next.balances[1]).toEqual({
      id: 'bal-1',
      accountId: 'a',
      date: '2026-11-22',
      amountMinor: 250,
      recordedAt: NOW.toISOString(),
    });
  });

  it('updates the existing entry when one exists on that date', () => {
    const next = upsertBalance(
      file,
      { accountId: 'a', date: '2026-11-01', amountMinor: -40 },
      opts(),
    );
    expect(next.balances).toEqual([
      expect.objectContaining({ id: 'old', amountMinor: -40, recordedAt: NOW.toISOString() }),
    ]);
  });

  it('rejects unknown accounts and non-integer amounts', () => {
    expect(() =>
      upsertBalance(file, { accountId: 'x', date: '2026-11-01', amountMinor: 1 }, opts()),
    ).toThrow();
    expect(() =>
      upsertBalance(file, { accountId: 'a', date: '2026-11-02', amountMinor: 1.5 }, opts()),
    ).toThrow();
  });
});

describe('accountHistory', () => {
  it('returns one account’s entries newest first', () => {
    const balances = [
      makeEntry({ id: '1', accountId: 'a', date: '2026-01-01' }),
      makeEntry({ id: '2', accountId: 'b', date: '2026-03-01' }),
      makeEntry({ id: '3', accountId: 'a', date: '2026-02-01' }),
    ];
    expect(accountHistory(balances, 'a').map((e) => e.id)).toEqual(['3', '1']);
  });
});

describe('same-day details', () => {
  it('orders same-day entries by most recently recorded', () => {
    const balances = [
      makeEntry({
        id: 'early',
        accountId: 'a',
        date: '2026-01-01',
        recordedAt: '2026-01-01T08:00:00.000Z',
      }),
      makeEntry({
        id: 'late',
        accountId: 'a',
        date: '2026-01-01',
        recordedAt: '2026-01-01T09:00:00.000Z',
      }),
    ];
    expect(accountHistory(balances, 'a').map((e) => e.id)).toEqual(['late', 'early']);
  });

  it('updates only the matching entry and leaves the others untouched', () => {
    const other = makeEntry({ id: 'other', accountId: 'a', date: '2026-10-01', amountMinor: 7 });
    const file = makeFile({
      accounts: [makeAccount({ id: 'a' })],
      balances: [
        other,
        makeEntry({ id: 'same', accountId: 'a', date: '2026-11-01', amountMinor: 1 }),
      ],
    });
    const next = upsertBalance(
      file,
      { accountId: 'a', date: '2026-11-01', amountMinor: 2 },
      { now: NOW, newId: idSequence() },
    );
    expect(next.balances[0]).toEqual(other);
    expect(next.balances[1]?.amountMinor).toBe(2);
  });
});

describe('allEntriesHaveDefaultSign', () => {
  it('ignores zero and checks the rest against the type’s default sign', () => {
    const entries = [makeEntry({ amountMinor: 5 }), makeEntry({ amountMinor: 0 })];
    expect(allEntriesHaveDefaultSign(entries, 'asset')).toBe(true);
    expect(allEntriesHaveDefaultSign(entries, 'liability')).toBe(false);
    expect(allEntriesHaveDefaultSign([makeEntry({ amountMinor: -5 })], 'liability')).toBe(true);
    expect(allEntriesHaveDefaultSign([], 'asset')).toBe(true);
  });
});

describe('deleteBalance / restoreBalance', () => {
  const entry = makeEntry({ id: 'x', accountId: 'a', date: '2026-11-01', amountMinor: 5 });
  const file = makeFile({ accounts: [makeAccount({ id: 'a' })], balances: [entry] });

  it('deletes an entry and can put it back', () => {
    const deleted = deleteBalance(file, 'x');
    expect(deleted.balances).toEqual([]);
    expect(restoreBalance(deleted, entry).balances).toEqual([entry]);
  });

  it('does not restore over a newer entry for the same day, or for a deleted account', () => {
    const deleted = deleteBalance(file, 'x');
    const replaced = {
      ...deleted,
      balances: [makeEntry({ id: 'y', accountId: 'a', date: '2026-11-01' })],
    };
    expect(restoreBalance(replaced, entry).balances.map((b) => b.id)).toEqual(['y']);
    expect(restoreBalance({ ...deleted, accounts: [] }, entry).balances).toEqual([]);
  });

  it('rejects unknown entries', () => {
    expect(() => deleteBalance(file, 'nope')).toThrow();
  });
});

describe('recordBalances', () => {
  it('records several balances for one date, updating any already there', () => {
    const data = makeFile({
      accounts: [makeAccount({ id: 'a' }), makeAccount({ id: 'b', name: 'B' })],
      balances: [makeEntry({ id: 'old', accountId: 'a', date: '2026-11-26', amountMinor: 1 })],
    });
    const ids = idSequence('n');
    const next = recordBalances(
      data,
      '2026-11-26',
      [
        { accountId: 'a', amountMinor: 500 },
        { accountId: 'b', amountMinor: -200 },
      ],
      { now: NOW, newId: ids },
    );
    expect(next.balances.map((e) => [e.id, e.accountId, e.date, e.amountMinor])).toEqual([
      ['old', 'a', '2026-11-26', 500],
      ['n-1', 'b', '2026-11-26', -200],
    ]);
    expect(recordBalances(data, '2026-11-26', [], { now: NOW, newId: ids })).toBe(data);
  });
});
