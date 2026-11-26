import { DEFAULT_LIST_OPTIONS } from '@/domain/accountList';
import { loadListOptions } from './useListOptions';

describe('loadListOptions', () => {
  it('reads back saved options', () => {
    const saved = {
      ...DEFAULT_LIST_OPTIONS,
      sort: { key: 'tag', direction: 'desc' },
      liquidity: [4, 5],
    };
    localStorage.setItem('trackworth.accountList', JSON.stringify(saved));
    expect(loadListOptions()).toEqual(saved);
  });

  it('falls back to the defaults when nothing, bad JSON or the wrong shape is stored', () => {
    expect(loadListOptions()).toEqual(DEFAULT_LIST_OPTIONS);
    localStorage.setItem('trackworth.accountList', 'not json');
    expect(loadListOptions()).toEqual(DEFAULT_LIST_OPTIONS);
    localStorage.setItem(
      'trackworth.accountList',
      JSON.stringify({ ...DEFAULT_LIST_OPTIONS, liquidity: [9] }),
    );
    expect(loadListOptions()).toEqual(DEFAULT_LIST_OPTIONS);
  });
});
