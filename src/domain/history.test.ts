import { makeFile } from '@/test/builders';
import { parseCsv, parseHistoryCsv, parseMonth, replaceNetWorthHistory } from './history';

const HEADER = 'Month/Year,Opening Worth,Closing Worth,Growth MoM,Growth MoM (%)';
const csv = (...rows: string[]) => [HEADER, ...rows].join('\r\n');

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas and line breaks', () => {
    expect(parseCsv('﻿a,"b,1","say ""hi"""\r\n"multi\nline",x\n')).toEqual([
      ['a', 'b,1', 'say "hi"'],
      ['multi\nline', 'x'],
    ]);
    expect(parseCsv('a,b')).toEqual([['a', 'b']]);
  });
});

describe('parseMonth', () => {
  it.each([
    ['April-2011', '2011-04'],
    ['Apr 2011', '2011-04'],
    ['sept/2012', '2012-09'],
    ['2011-4', '2011-04'],
    ['2011-12', '2011-12'],
  ])('reads %s', (text, month) => {
    expect(parseMonth(text)).toBe(month);
  });

  it.each(['2011-13', 'Ap-2011', 'Smarch-2011', 'April', ''])('rejects %s', (text) => {
    expect(parseMonth(text)).toBeNull();
  });
});

describe('parseHistoryCsv', () => {
  it('uses each closing worth at month end, and the first opening worth the month before', () => {
    const result = parseHistoryCsv(
      csv(
        'May-2011,"1,200.00 ","1,250.50 ","50.50",4%',
        'April-2011,"1,000.00 ","1,200.00 ","200.00",20%',
        ',,,,',
        'June-2011,"1,250.50 ","-20.00 ","-1,270.50",-101%',
      ),
      'INR',
    );
    expect(result).toEqual({
      ok: true,
      notes: [],
      points: [
        { date: '2011-03-31', amountMinor: 1_000_00, currency: 'INR' },
        { date: '2011-04-30', amountMinor: 1_200_00, currency: 'INR' },
        { date: '2011-05-31', amountMinor: 1_250_50, currency: 'INR' },
        { date: '2011-06-30', amountMinor: -20_00, currency: 'INR' },
      ],
    });
  });

  it('uses a repeated month once when the values match, and refuses when they differ', () => {
    const same = parseHistoryCsv(csv('May-2012,1,"2.00"', 'May-2012,1,"2.00"'), 'USD');
    expect(same).toMatchObject({
      ok: true,
      notes: ['May-2012 appears twice with the same value; used once.'],
    });
    expect(parseHistoryCsv(csv('May-2012,1,"2.00"', 'May-2012,1,"3.00"'), 'USD')).toEqual({
      ok: false,
      error: 'Row 3: May-2012 appears twice with different values.',
    });
  });

  it('works without an opening column, and skips an unreadable opening', () => {
    expect(parseHistoryCsv('Month,Closing\nJan 2020,5', 'USD')).toEqual({
      ok: true,
      notes: [],
      points: [{ date: '2020-01-31', amountMinor: 500, currency: 'USD' }],
    });
    expect(parseHistoryCsv(csv('Jan 2020,n/a,5'), 'USD')).toMatchObject({
      ok: true,
      points: [{ date: '2020-01-31' }],
    });
  });

  it('explains what’s wrong', () => {
    expect(parseHistoryCsv('', 'USD')).toEqual({ ok: false, error: 'The file is empty.' });
    expect(parseHistoryCsv('Date,Value\n2020-01,5', 'USD')).toMatchObject({
      ok: false,
      error: expect.stringContaining('Couldn’t find the columns') as string,
    });
    expect(parseHistoryCsv(HEADER, 'USD')).toEqual({
      ok: false,
      error: 'No months found below the header row.',
    });
    expect(parseHistoryCsv(csv('Someday,1,2'), 'USD')).toEqual({
      ok: false,
      error: 'Row 2: “Someday” isn’t a month.',
    });
    expect(parseHistoryCsv(csv('Jan 2020,1,lots'), 'USD')).toEqual({
      ok: false,
      error: 'Row 2: “lots” isn’t an amount.',
    });
    expect(parseHistoryCsv('Month,Closing\nJan 2020', 'USD')).toMatchObject({ ok: false });
  });
});

describe('replaceNetWorthHistory', () => {
  it('replaces one currency’s history and keeps the others', () => {
    const data = makeFile({
      netWorthHistory: [
        { date: '2019-01-31', amountMinor: 1, currency: 'USD' },
        { date: '2019-01-31', amountMinor: 2, currency: 'EUR' },
      ],
    });
    const next = replaceNetWorthHistory(data, 'USD', [
      { date: '2020-01-31', amountMinor: 3, currency: 'USD' },
    ]);
    expect(next.netWorthHistory).toEqual([
      { date: '2019-01-31', amountMinor: 2, currency: 'EUR' },
      { date: '2020-01-31', amountMinor: 3, currency: 'USD' },
    ]);
  });
});
