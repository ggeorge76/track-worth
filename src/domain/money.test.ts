import { formatMoney, parseMoneyInput } from './money';

describe('parseMoneyInput', () => {
  it.each([
    ['1234.56', 'USD', 123456],
    ['1,234.5', 'USD', 123450],
    ['-20', 'USD', -2000],
    ['0.1', 'USD', 10],
    ['500', 'JPY', 500],
  ])('parses %s %s -> %d', (input, currency, expected) => {
    expect(parseMoneyInput(input, currency)).toBe(expected);
  });

  it.each([['abc'], [''], ['1.234'], ['1.2.3'], ['--1']])('rejects %s', (input) => {
    expect(parseMoneyInput(input, 'USD')).toBeNull();
  });

  it('rejects amounts too large to represent exactly', () => {
    expect(parseMoneyInput('99999999999999999', 'USD')).toBeNull();
  });

  it('rejects decimals for zero-decimal currencies', () => {
    expect(parseMoneyInput('5.5', 'JPY')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats minor units with the currency precision', () => {
    expect(formatMoney(123456, 'USD', 'en-US')).toBe('$1,234.56');
    expect(formatMoney(500, 'JPY', 'en-US')).toBe('¥500');
  });
});
