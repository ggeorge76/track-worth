import { currencyCodes, currencyLabel, suggestedCurrency } from './currencies';

describe('currencies', () => {
  it('lists common currencies first, then the rest alphabetically, without duplicates', () => {
    const codes = currencyCodes();
    expect(codes.slice(0, 3)).toEqual(['INR', 'USD', 'EUR']);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toContain('NZD');
  });

  it('labels currencies with their name', () => {
    expect(currencyLabel('INR', 'en')).toBe('INR · Indian Rupee');
  });

  it('suggests the most used currency, else the base currency', () => {
    expect(suggestedCurrency(['INR', 'USD', 'INR'], 'USD')).toBe('INR');
    expect(suggestedCurrency([], 'EUR')).toBe('EUR');
  });
});
