import { daysBetween, describeDateAgo } from './relativeDate';

describe('relative dates', () => {
  it('counts whole days, across month and DST boundaries', () => {
    expect(daysBetween('2026-11-14', '2026-11-22')).toBe(8);
    expect(daysBetween('2026-02-28', '2026-03-01')).toBe(1);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
  });

  it.each([
    ['2026-11-22', 'today'],
    ['2026-11-21', 'yesterday'],
    ['2026-11-14', '8 days ago'],
    ['2026-10-20', 'last month'],
    ['2026-08-22', '3 months ago'],
    ['2024-11-22', '2 years ago'],
    ['2026-11-24', 'in 2 days'],
  ])('%s → %s', (date, text) => {
    expect(describeDateAgo(date, '2026-11-22', 'en')).toBe(text);
  });
});
