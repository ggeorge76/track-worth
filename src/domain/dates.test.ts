import { financialYearStart, localIsoDate, startOfMonth } from './dates';

describe('dates', () => {
  it('formats local dates', () => {
    expect(localIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('finds the start of the month', () => {
    expect(startOfMonth('2026-11-22')).toBe('2026-11-01');
  });

  it.each([
    ['2026-02-10', 4, '2025-04-01'],
    ['2026-04-01', 4, '2026-04-01'],
    ['2026-11-22', 4, '2026-04-01'],
    ['2026-11-22', 1, '2026-01-01'],
    ['2026-06-30', 7, '2025-07-01'],
    ['2026-12-31', 12, '2026-12-01'],
  ])('financial year containing %s (start month %i) begins %s', (date, month, expected) => {
    expect(financialYearStart(date, month)).toBe(expected);
  });
});
