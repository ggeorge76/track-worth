import { makeAccount, makeEntry, makeFile } from '@/test/builders';
import { exportFileName, toBackupJson, toBalancesCsv } from './export';
import { parseDataFile } from './schema';

const BOM = '﻿';
const lines = (csv: string) => csv.slice(1).split('\r\n');

describe('exportFileName', () => {
  it('names files by kind and date', () => {
    expect(exportFileName('backup', '2026-11-23')).toBe('trackworth-backup-2026-11-23.json');
    expect(exportFileName('balances', '2026-11-23')).toBe('trackworth-balances-2026-11-23.csv');
  });
});

describe('toBackupJson', () => {
  it('is readable JSON that loads back as the same data', () => {
    const data = makeFile({
      accounts: [makeAccount({ id: 'a', name: 'Bank 🏦' })],
      balances: [makeEntry({ accountId: 'a', amountMinor: 12345 })],
    });
    const json = toBackupJson(data);
    expect(json).toContain('\n  "schemaVersion": 4');
    expect(json.endsWith('\n')).toBe(true);
    expect(parseDataFile(JSON.parse(json))).toEqual({ ok: true, data });
  });
});

describe('toBalancesCsv', () => {
  it('writes a header only when there are no balances', () => {
    expect(toBalancesCsv(makeFile())).toBe(`${BOM}Date,Account,Type,Tag,Currency,Amount,Note\r\n`);
  });

  it('lists entries oldest first, then in account order, with signed plain amounts', () => {
    const data = makeFile({
      accounts: [
        makeAccount({ id: 'bank', name: 'Bank', currency: 'USD' }),
        makeAccount({ id: 'loan', name: 'Loan', kind: 'liability', tag: 'Loan', currency: 'JPY' }),
      ],
      balances: [
        makeEntry({ accountId: 'loan', date: '2026-02-01', amountMinor: -500000 }),
        makeEntry({ accountId: 'bank', date: '2026-02-01', amountMinor: 5 }),
        makeEntry({ accountId: 'bank', date: '2026-01-01', amountMinor: 123456, note: 'Pay' }),
      ],
    });
    expect(lines(toBalancesCsv(data))).toEqual([
      'Date,Account,Type,Tag,Currency,Amount,Note',
      '2026-01-01,Bank,Asset,Cash,USD,1234.56,Pay',
      '2026-02-01,Bank,Asset,Cash,USD,0.05,',
      '2026-02-01,Loan,Liability,Loan,JPY,-500000,',
      '',
    ]);
  });

  it('quotes commas, quotes and line breaks', () => {
    const data = makeFile({
      accounts: [makeAccount({ id: 'a', name: 'Joint, "main"' })],
      balances: [makeEntry({ accountId: 'a', note: 'line 1\nline 2' })],
    });
    expect(lines(toBalancesCsv(data))[1]).toBe(
      '2026-01-01,"Joint, ""main""",Asset,Cash,USD,0.00,"line 1\nline 2"',
    );
  });

  it('keeps typed text from running as a spreadsheet formula', () => {
    const data = makeFile({
      accounts: [makeAccount({ id: 'a', name: '=SUM(A1)', tag: '+tag' })],
      balances: [makeEntry({ accountId: 'a', amountMinor: -100, note: '@note' })],
    });
    expect(lines(toBalancesCsv(data))[1]).toBe("2026-01-01,'=SUM(A1),Asset,'+tag,USD,-1.00,'@note");
  });

  it('skips entries whose account is missing', () => {
    const data = makeFile({ balances: [makeEntry({ accountId: 'gone' })] });
    expect(lines(toBalancesCsv(data))).toHaveLength(2);
  });
});
