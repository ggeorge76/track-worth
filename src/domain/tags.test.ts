import { makeAccount, makeFile } from '@/test/builders';
import { availableTags, canonicalTag, DEFAULT_TAGS, withCustomTag } from './tags';

describe('tags', () => {
  const file = makeFile({
    settings: { financialYearStartMonth: 4, customTags: ['🪙 Gold', 'cash'] },
    accounts: [makeAccount({ tag: 'Crypto' }), makeAccount({ id: 'b', tag: '🪙 gold' })],
  });

  it('lists defaults first, then custom and in-use tags alphabetically, without duplicates', () => {
    const extras = ['🪙 Gold', 'Crypto'].sort((a, b) => a.localeCompare(b));
    expect(availableTags(file)).toEqual([...DEFAULT_TAGS, ...extras]);
  });

  it('reuses an existing spelling', () => {
    expect(canonicalTag(file, ' CASH ')).toBe('Cash');
    expect(canonicalTag(file, 'new one')).toBe('new one');
  });

  it('adds only genuinely new tags to settings', () => {
    expect(withCustomTag(file, 'Equity')).toBe(file);
    expect(withCustomTag(file, '🪙 GOLD')).toBe(file);
    expect(withCustomTag(file, ' Art ').settings.customTags).toEqual(['🪙 Gold', 'cash', 'Art']);
  });
});
