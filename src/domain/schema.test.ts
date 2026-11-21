import { createEmptyDataFile, parseDataFile, SCHEMA_VERSION } from './schema';

const validFile = {
  schemaVersion: SCHEMA_VERSION,
  updatedAt: '2026-01-01T00:00:00.000Z',
  baseCurrency: 'USD',
  accounts: [
    {
      id: 'a1',
      name: 'Checking',
      kind: 'asset',
      category: 'bank',
      currency: 'USD',
      archived: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  balances: [
    {
      id: 'b1',
      accountId: 'a1',
      date: '2026-01-01',
      amountMinor: 123456,
      recordedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

describe('parseDataFile', () => {
  it('accepts a valid file', () => {
    const result = parseDataFile(validFile);
    expect(result.ok).toBe(true);
  });

  it('rejects files written by a newer schema version instead of stripping data', () => {
    const result = parseDataFile({ ...validFile, schemaVersion: SCHEMA_VERSION + 1 });
    expect(result).toEqual({
      ok: false,
      reason: 'newer-version',
      schemaVersion: SCHEMA_VERSION + 1,
    });
  });

  it('rejects non-integer money amounts', () => {
    const bad = {
      ...validFile,
      balances: [{ ...validFile.balances[0], amountMinor: 12.5 }],
    };
    const result = parseDataFile(bad);
    expect(result.ok).toBe(false);
  });

  it('rejects garbage', () => {
    expect(parseDataFile('nope').ok).toBe(false);
    expect(parseDataFile(null).ok).toBe(false);
  });
});

describe('createEmptyDataFile', () => {
  it('produces a file that round-trips through the parser', () => {
    const empty = createEmptyDataFile('EUR', new Date('2026-05-01T00:00:00Z'));
    expect(parseDataFile(JSON.parse(JSON.stringify(empty)))).toEqual({ ok: true, data: empty });
  });
});
