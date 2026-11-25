import { act, renderHook } from '@testing-library/react';
import {
  goBack,
  hrefFor,
  navigate,
  parseHash,
  useHistoryIndex,
  useRoute,
  useScrollToTop,
  type Route,
} from './router';

describe('parseHash / hrefFor', () => {
  it.each([
    ['', { name: 'home' }],
    ['#/', { name: 'home' }],
    ['#/accounts/new', { name: 'new-account' }],
    ['#/settings', { name: 'settings' }],
    ['#/insights', { name: 'insights' }],
    ['#/currencies', { name: 'currencies' }],
    ['#/accounts/abc%20123', { name: 'account', id: 'abc 123' }],
    ['#/nope', { name: 'not-found' }],
  ])('parses %s', (hash, route) => {
    expect(parseHash(hash)).toEqual(route);
  });

  it('round-trips routes through links', () => {
    for (const route of [
      { name: 'home' },
      { name: 'new-account' },
      { name: 'settings' },
      { name: 'insights' },
      { name: 'currencies' },
      { name: 'account', id: 'id/with?chars' },
    ] as const) {
      expect(parseHash(hrefFor(route))).toEqual(route);
    }
  });
});

describe('navigation and back', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '#/');
  });

  const nextHashChange = () =>
    new Promise((resolve) => {
      window.addEventListener('hashchange', resolve, { once: true });
    });

  it('follows navigation and the back button', async () => {
    const { result } = renderHook(() => {
      useHistoryIndex();
      return useRoute();
    });
    expect(result.current).toEqual({ name: 'home' });

    let changed = nextHashChange();
    navigate({ name: 'new-account' });
    await act(async () => {
      await changed;
    });
    expect(result.current).toEqual({ name: 'new-account' });

    changed = nextHashChange();
    goBack();
    await act(async () => {
      await changed;
    });
    expect(result.current).toEqual({ name: 'home' });
  });

  it('replace does not add a history entry', () => {
    const before = window.history.length;
    act(() => {
      navigate({ name: 'account', id: 'x' }, { replace: true });
    });
    expect(window.location.hash).toBe('#/accounts/x');
    expect(window.history.length).toBe(before);
  });

  it('goes to the start page when there is nothing to go back to', () => {
    window.history.replaceState({ idx: 0 }, '', '#/accounts/x');
    act(() => {
      goBack();
    });
    expect(window.location.hash).toBe('#/');
  });
});

describe('useScrollToTop', () => {
  it('scrolls to the top whenever the page changes', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    const { rerender } = renderHook(
      ({ route }: { route: Route }) => {
        useScrollToTop(route);
      },
      { initialProps: { route: { name: 'home' } as Route } },
    );
    expect(scrollTo).toHaveBeenCalledTimes(1);
    rerender({ route: { name: 'home' } });
    expect(scrollTo).toHaveBeenCalledTimes(1); // same page: stays put
    rerender({ route: { name: 'insights' } });
    rerender({ route: { name: 'account', id: 'a' } });
    expect(scrollTo).toHaveBeenCalledTimes(3);
    expect(window.history.scrollRestoration).toBe('manual');
    scrollTo.mockRestore();
  });
});
