import {
  formatMoney,
  formatPercent,
  formatSignedMoney,
  minorToInput,
  parseMoneyInput,
  percentChange,
} from './money';

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

describe('signed amounts and percentages', () => {
  it('formats changes with an explicit sign', () => {
    expect(formatSignedMoney(4200, 'USD', 'en-US')).toBe('+$42.00');
    expect(formatSignedMoney(-64500, 'USD', 'en-US')).toBe('-$645.00');
    expect(formatSignedMoney(0, 'USD', 'en-US')).toBe('$0.00');
  });

  it('turns minor units back into input text', () => {
    expect(minorToInput(123450, 'USD')).toBe('1234.50');
    expect(minorToInput(-5, 'USD')).toBe('0.05');
    expect(minorToInput(500, 'JPY')).toBe('500');
  });

  it('computes percent change relative to the size of the base', () => {
    expect(percentChange(500, 10_000)).toBe(5);
    expect(percentChange(200, -1000)).toBe(20); // debt shrank
    expect(percentChange(5, 0)).toBeNull();
    expect(formatPercent(4.666, 'en')).toBe('+4.7%');
    expect(formatPercent(-20, 'en')).toBe('-20%');
    expect(formatPercent(0, 'en')).toBe('0%');
  });
});
