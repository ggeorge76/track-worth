import { addDays, addYears } from '../dates';
import {
  assertValidPeriods,
  ensureCovered,
  fileNameFor,
  findPeriod,
  realign,
  type Period,
} from './periods';

const p = (from: string, to: string): Period => ({ file: fileNameFor(from), from, to });
const summary = (ps: Period[]) => ps.map((x) => `${x.file} ${x.from}..${x.to}`);

describe('date helpers', () => {
  it('adds days and years', () => {
    expect(addDays('2026-03-31', 1)).toBe('2026-04-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addYears('2026-04-01', -1)).toBe('2025-04-01');
    expect(addYears('2028-02-29', -1)).toBe('2027-02-28');
  });
});

describe('ensureCovered', () => {
  it('starts with the financial year of the first date', () => {
    expect(summary(ensureCovered([], ['2026-11-22'], 4))).toEqual([
      'balances/2026.json 2026-04-01..2027-03-31',
    ]);
    expect(summary(ensureCovered([], ['2026-11-22'], 1))).toEqual([
      'balances/2026.json 2026-01-01..2026-12-31',
    ]);
    expect(summary(ensureCovered([], ['2026-02-10'], 4))).toEqual([
      'balances/2025.json 2025-04-01..2026-03-31',
    ]);
  });

  it('adds following years for later dates', () => {
    const result = ensureCovered([p('2025-04-01', '2026-03-31')], ['2027-05-01'], 4);
    expect(summary(result)).toEqual([
      'balances/2025.json 2025-04-01..2026-03-31',
      'balances/2026.json 2026-04-01..2027-03-31',
      'balances/2027.json 2027-04-01..2028-03-31',
    ]);
  });

  it('adds 12-month files backwards for earlier dates (imports)', () => {
    const result = ensureCovered([p('2025-04-01', '2026-03-31')], ['2023-06-15', '2025-05-01'], 4);
    expect(summary(result)).toEqual([
      'balances/2023.json 2023-04-01..2024-03-31',
      'balances/2024.json 2024-04-01..2025-03-31',
      'balances/2025.json 2025-04-01..2026-03-31',
    ]);
  });

  it('extends a short last file instead of creating a second file for the same year', () => {
    // After a Jan→Apr realignment a file can end mid-year in its own start year.
    const result = ensureCovered([p('2026-01-01', '2026-03-31')], ['2026-06-01'], 4);
    expect(summary(result)).toEqual(['balances/2026.json 2026-01-01..2027-03-31']);
  });

  it('leaves covered dates alone', () => {
    const periods = [p('2025-04-01', '2026-03-31')];
    expect(ensureCovered(periods, ['2025-12-01'], 4)).toEqual(periods);
  });
});

describe('realign (changing the financial year)', () => {
  it('example A: Apr–Mar → Jan–Dec in Nov 2026', () => {
    const before = [
      p('2024-04-01', '2025-03-31'),
      p('2025-04-01', '2026-03-31'),
      p('2026-04-01', '2027-03-31'),
    ];
    expect(summary(realign(before, '2026-11-22', 1))).toEqual([
      'balances/2024.json 2024-04-01..2025-03-31', // unchanged
      'balances/2025.json 2025-04-01..2025-12-31', // shortened
      'balances/2026.json 2026-01-01..2026-12-31', // current year, new setting
    ]);
  });

  it('example B: Jan–Dec → Apr–Mar in Nov 2026', () => {
    const before = [
      p('2024-01-01', '2024-12-31'),
      p('2025-01-01', '2025-12-31'),
      p('2026-01-01', '2026-12-31'),
    ];
    expect(summary(realign(before, '2026-11-22', 4))).toEqual([
      'balances/2024.json 2024-01-01..2024-12-31', // unchanged
      'balances/2025.json 2025-01-01..2026-03-31', // gains Jan–Mar 2026 (15 months)
      'balances/2026.json 2026-04-01..2027-03-31', // current year, new setting
    ]);
  });

  it('lengthens the previous file to close a gap when nothing was recorded for a while', () => {
    const before = [p('2023-04-01', '2024-03-31')];
    expect(summary(realign(before, '2026-11-22', 1))).toEqual([
      'balances/2023.json 2023-04-01..2025-12-31',
      'balances/2026.json 2026-01-01..2026-12-31',
    ]);
  });

  it('lets the current file absorb the leftover when there is no earlier file to join', () => {
    const before = [p('2026-01-01', '2026-12-31')];
    expect(summary(realign(before, '2026-11-22', 4))).toEqual([
      'balances/2026.json 2026-01-01..2027-03-31',
    ]);
  });

  it('does nothing without files', () => {
    expect(realign([], '2026-11-22', 1)).toEqual([]);
  });

  it('keeps every result valid when switching through all start months', () => {
    let periods = ensureCovered([], ['2015-07-01', '2026-11-01'], 4);
    for (let month = 1; month <= 12; month++) {
      periods = realign(periods, '2026-11-22', month);
      expect(() => {
        assertValidPeriods(periods);
      }).not.toThrow();
      expect(findPeriod(periods, '2015-07-01')).toBeDefined();
      expect(findPeriod(periods, '2026-11-22')).toBeDefined();
    }
  });
});

describe('assertValidPeriods', () => {
  it.each([
    [
      'overlap',
      [
        p('2025-01-01', '2025-12-31'),
        { file: 'balances/2025.json', from: '2025-06-01', to: '2026-05-31' },
      ],
    ],
    ['gap', [p('2024-01-01', '2024-12-31'), p('2026-01-01', '2026-12-31')]],
    ['inverted', [p('2025-12-31', '2025-01-01')]],
    ['misnamed', [{ file: 'balances/1999.json', from: '2025-01-01', to: '2025-12-31' }]],
  ])('rejects %s', (_name, periods) => {
    expect(() => {
      assertValidPeriods(periods);
    }).toThrow();
  });
});
