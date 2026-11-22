import { makeFile } from '@/test/builders';
import { updateSettings } from './settingsOps';

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
