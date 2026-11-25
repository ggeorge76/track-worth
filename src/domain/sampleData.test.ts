import { makeFile } from '@/test/builders';
import { createConverter } from './fx';
import { netWorthInBase } from './netWorth';
import { sampleDataFile } from './sampleData';

const TODAY = '2026-11-26';

describe('sampleDataFile', () => {
  const data = sampleDataFile(TODAY, makeFile());

  it('is valid data with nine accounts and 37 balances each', () => {
    expect(data.accounts).toHaveLength(9);
    expect(data.balances).toHaveLength(9 * 37);
    expect(data.baseCurrency).toBe('INR');
    expect(data.balances.every((b) => b.date <= TODAY)).toBe(true);
  });

  it('is the same every time, and ends at the planned balances', () => {
    expect(sampleDataFile(TODAY, makeFile())).toEqual(data);
    const fx = createConverter(
      'INR',
      { base: 'INR', latest: { date: TODAY, rates: { USD: 0.0125 } }, monthly: {} },
      {},
      TODAY,
    );
    // ₹36.6L in INR assets + $12,400 (₹9.92L) − ₹28.5L loan − ₹24.5k card = ₹17,77,500
    expect(netWorthInBase(data, fx, TODAY).netMinor).toBe(1_777_500_00);
  });
});
