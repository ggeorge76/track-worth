import {
  addMonths,
  endOfMonth,
  isoDateToUtcMs,
  financialYearEnd,
  financialYearStart,
  formatIsoDate,
  localIsoDate,
  monthNames,
  startOfMonth,
} from './dates';

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

describe('date display helpers', () => {
  it('formats ISO dates without time-zone drift', () => {
    expect(formatIsoDate('2026-11-09', 'en-GB')).toBe('9 Nov 2026');
    expect(formatIsoDate('2026-01-01', 'en-US')).toBe('Jan 1, 2026');
  });

  it('lists month names', () => {
    const months = monthNames('en');
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('January');
    expect(months[3]).toBe('April');
  });

  it('finds the last day of a financial year', () => {
    expect(financialYearEnd('2026-04-01')).toBe('2027-03-31');
    expect(financialYearEnd('2026-01-01')).toBe('2026-12-31');
    expect(financialYearEnd('2027-03-01')).toBe('2028-02-29');
  });
});

describe('addMonths / endOfMonth / isoDateToUtcMs', () => {
  it('moves by months, clamping to the month end', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-11-23', -12)).toBe('2025-11-23');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('finds the last day of a month', () => {
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(endOfMonth('2026-12-01')).toBe('2026-12-31');
  });

  it('converts a date to UTC milliseconds', () => {
    expect(isoDateToUtcMs('1970-01-02')).toBe(86_400_000);
  });
});
