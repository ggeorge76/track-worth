import { checkSignedAmount } from './amountInput';

describe('checkSignedAmount', () => {
  it('treats empty input as no amount', () => {
    expect(checkSignedAmount('  ', 'positive', 'USD')).toEqual({ ok: true, amountMinor: null });
  });

  it('applies the sign to a valid amount', () => {
    expect(checkSignedAmount('1,234.5', 'positive', 'USD')).toEqual({
      ok: true,
      amountMinor: 123450,
    });
    expect(checkSignedAmount('500', 'negative', 'INR')).toEqual({ ok: true, amountMinor: -50000 });
  });

  it.each([
    ['-5', /minus sign/],
    ['abc', /Enter an amount/],
  ])('explains why "%s" is not accepted', (input, message) => {
    const result = checkSignedAmount(input, 'positive', 'USD');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });
});
