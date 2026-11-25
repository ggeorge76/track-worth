import { makeFile } from '@/test/builders';
import { setBaseCurrency, updateSettings } from './settingsOps';

describe('updateSettings', () => {
  it('changes the financial year start and keeps other settings', () => {
    const file = makeFile({ settings: { financialYearStartMonth: 4, customTags: ['Gold'] } });
    expect(updateSettings(file, { financialYearStartMonth: 1 }).settings).toEqual({
      financialYearStartMonth: 1,
      customTags: ['Gold'],
    });
  });

  it('rejects invalid months', () => {
    expect(() => updateSettings(makeFile(), { financialYearStartMonth: 13 })).toThrow();
  });
});

describe('setBaseCurrency', () => {
  it('changes the base currency and rejects codes that aren’t ISO 4217-shaped', () => {
    expect(setBaseCurrency(makeFile(), 'INR').baseCurrency).toBe('INR');
    expect(() => setBaseCurrency(makeFile(), 'rupee')).toThrow();
  });
});
