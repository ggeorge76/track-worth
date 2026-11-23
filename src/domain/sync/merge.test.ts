import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import type { DataFile } from '../schema';
import { threeWayMerge } from './merge';

const T = (h: number) => `2026-11-2${String(h)}T10:00:00.000Z`;
const base = makeFile({
  accounts: [
    makeAccount({ id: 'a', name: 'Bank' }),
    makeAccount({ id: 'b', name: 'Card', kind: 'liability' }),
  ],
  balances: [
    makeEntry({ id: 'e1', accountId: 'a', date: '2026-10-31', amountMinor: 100, recordedAt: T(0) }),
    makeEntry({ id: 'e2', accountId: 'b', date: '2026-10-31', amountMinor: -50, recordedAt: T(0) }),
  ],
});
const edit = (d: DataFile, change: (d: DataFile) => Partial<DataFile>): DataFile => ({
  ...d,
  ...change(d),
});
const amounts = (d: DataFile) => Object.fromEntries(d.balances.map((b) => [b.id, b.amountMinor]));

describe('balances merge automatically', () => {
  it('keeps changes from both sides', () => {
    const local = edit(base, (d) => ({
      balances: [
        ...d.balances,
        makeEntry({
          id: 'L',
          accountId: 'a',
          date: '2026-11-20',
          amountMinor: 7,
          recordedAt: T(1),
        }),
      ],
    }));
    const remote = edit(base, (d) => ({
      balances: d.balances.map((e) =>
        e.id === 'e2' ? { ...e, amountMinor: -60, recordedAt: T(1) } : e,
      ),
    }));
    const { data, questions } = threeWayMerge(base, local, remote);
    expect(questions).toEqual([]);
    expect(amounts(data)).toEqual({ e1: 100, e2: -60, L: 7 });
  });

  it('takes the later change when both sides edited the same entry', () => {
    const local = edit(base, (d) => ({
      balances: d.balances.map((e) =>
        e.id === 'e1' ? { ...e, amountMinor: 111, recordedAt: T(3) } : e,
      ),
    }));
    const remote = edit(base, (d) => ({
      balances: d.balances.map((e) =>
        e.id === 'e1' ? { ...e, amountMinor: 222, recordedAt: T(2) } : e,
      ),
    }));
    expect(amounts(threeWayMerge(base, local, remote).data).e1).toBe(111);
    expect(amounts(threeWayMerge(base, remote, local).data).e1).toBe(111);
  });

  it('keeps one entry per account and day when both sides added one, the later winning', () => {
    const local = edit(base, (d) => ({
      balances: [
        ...d.balances,
        makeEntry({
          id: 'L',
          accountId: 'a',
          date: '2026-11-22',
          amountMinor: 1,
          recordedAt: T(5),
        }),
      ],
    }));
    const remote = edit(base, (d) => ({
      balances: [
        ...d.balances,
        makeEntry({
          id: 'R',
          accountId: 'a',
          date: '2026-11-22',
          amountMinor: 2,
          recordedAt: T(4),
        }),
      ],
    }));
    const { data } = threeWayMerge(base, local, remote);
    expect(data.balances.filter((e) => e.date === '2026-11-22').map((e) => e.id)).toEqual(['L']);
  });

  it('prefers this device’s entry on an exact tie', () => {
    const local = edit(base, (d) => ({
      balances: [
        ...d.balances,
        makeEntry({ id: 'L', accountId: 'a', date: '2026-11-22', recordedAt: T(5) }),
      ],
    }));
    const remote = edit(base, (d) => ({
      balances: [
        ...d.balances,
        makeEntry({ id: 'R', accountId: 'a', date: '2026-11-22', recordedAt: T(5) }),
      ],
    }));
    expect(threeWayMerge(base, local, remote).data.balances.some((e) => e.id === 'L')).toBe(true);
  });

  it('keeps an edit rather than a removal made on the other side', () => {
    const local = edit(base, (d) => ({
      balances: d.balances.map((e) =>
        e.id === 'e1' ? { ...e, amountMinor: 5, recordedAt: T(1) } : e,
      ),
    }));
    const remote = edit(base, (d) => ({ balances: d.balances.filter((e) => e.id !== 'e1') }));
    expect(amounts(threeWayMerge(base, local, remote).data).e1).toBe(5);
  });

  it('applies a removal when the other side left the entry alone', () => {
    const local = edit(base, (d) => ({ balances: d.balances.filter((e) => e.id !== 'e1') }));
    expect(amounts(threeWayMerge(base, local, base).data)).toEqual({ e2: -50 });
  });
});

describe('accounts are decided per account', () => {
  it('takes accounts changed or created on one side without asking', () => {
    const local = edit(base, (d) => ({
      accounts: [...d.accounts, makeAccount({ id: 'new', name: 'Offline account' })],
    }));
    const remote = edit(base, (d) => ({
      accounts: d.accounts.map((a) => (a.id === 'b' ? { ...a, name: 'Card (renamed)' } : a)),
    }));
    const { data, questions } = threeWayMerge(base, local, remote);
    expect(questions).toEqual([]);
    expect(data.accounts.map((a) => a.name)).toEqual(['Bank', 'Card (renamed)', 'Offline account']);
  });

  it('accepts identical changes on both sides', () => {
    const renamed = edit(base, (d) => ({
      accounts: d.accounts.map((a) => (a.id === 'a' ? { ...a, name: 'Same' } : a)),
    }));
    expect(threeWayMerge(base, renamed, renamed).questions).toEqual([]);
  });

  it('asks when both sides changed the same account differently, then applies the answer', () => {
    const local = edit(base, (d) => ({
      accounts: d.accounts.map((a) => (a.id === 'a' ? { ...a, name: 'Local name' } : a)),
    }));
    const remote = edit(base, (d) => ({
      accounts: d.accounts.map((a) => (a.id === 'a' ? { ...a, liquidity: 1 } : a)),
    }));
    const unanswered = threeWayMerge(base, local, remote);
    expect(unanswered.questions).toEqual([
      { kind: 'account', id: 'a', local: local.accounts[0], remote: remote.accounts[0] },
    ]);
    // No field-by-field merge: one side or the other.
    expect(threeWayMerge(base, local, remote, { a: 'local' }).data.accounts[0]).toMatchObject({
      name: 'Local name',
      liquidity: 3,
    });
    expect(threeWayMerge(base, local, remote, { a: 'remote' }).data.accounts[0]).toMatchObject({
      name: 'Bank',
      liquidity: 1,
    });
    expect(threeWayMerge(base, local, remote, { a: 'local' }).questions).toEqual([]);
  });
});

describe('settings are decided as a whole', () => {
  it('takes a one-sided change and asks when both changed differently', () => {
    const local = edit(base, (d) => ({ settings: { ...d.settings, financialYearStartMonth: 1 } }));
    const remote = edit(base, (d) => ({ settings: { ...d.settings, customTags: ['Gold'] } }));
    expect(threeWayMerge(base, local, base).data.settings.financialYearStartMonth).toBe(1);
    const { questions } = threeWayMerge(base, local, remote);
    expect(questions).toEqual([
      {
        kind: 'settings',
        local: { baseCurrency: 'USD', settings: local.settings },
        remote: { baseCurrency: 'USD', settings: remote.settings },
      },
    ]);
    expect(threeWayMerge(base, local, remote, { settings: 'local' }).data.settings).toEqual(
      local.settings,
    );
  });
});
