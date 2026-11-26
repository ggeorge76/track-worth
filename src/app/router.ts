import { useEffect, useSyncExternalStore } from 'react';

/**
 * Tiny hash router (ADR-0013). Every screen change is a real history entry, so the browser,
 * desktop and Android back buttons all work.
 */
export type Route =
  | { name: 'home' }
  | { name: 'new-account' }
  | { name: 'account'; id: string }
  | { name: 'settings' }
  | { name: 'insights' }
  | { name: 'currencies' }
  | { name: 'update-all' }
  | { name: 'not-found' };

const ACCOUNT_PATH = /^\/accounts\/([^/]+)$/;

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '') || '/';
  if (path === '/') return { name: 'home' };
  if (path === '/accounts/new') return { name: 'new-account' };
  if (path === '/settings') return { name: 'settings' };
  if (path === '/insights') return { name: 'insights' };
  if (path === '/currencies') return { name: 'currencies' };
  if (path === '/update') return { name: 'update-all' };
  const match = ACCOUNT_PATH.exec(path);
  if (match?.[1]) return { name: 'account', id: decodeURIComponent(match[1]) };
  return { name: 'not-found' };
}

export function hrefFor(route: Route): string {
  switch (route.name) {
    case 'home':
    case 'not-found':
      return '#/';
    case 'new-account':
      return '#/accounts/new';
    case 'settings':
      return '#/settings';
    case 'insights':
      return '#/insights';
    case 'currencies':
      return '#/currencies';
    case 'update-all':
      return '#/update';
    case 'account':
      return `#/accounts/${encodeURIComponent(route.id)}`;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
}

const getHash = () => window.location.hash;

export function useRoute(): Route {
  return parseHash(useSyncExternalStore(subscribe, getHash, getHash));
}

export function navigate(route: Route, { replace = false } = {}): void {
  const href = hrefFor(route);
  if (replace) {
    window.history.replaceState(window.history.state, '', href);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = href;
  }
}

/** Go back one screen, or to the start page if this is the first screen in the session. */
export function goBack(): void {
  // `history.state` is null on the very first entry; entries we push carry `{ idx }`.
  const canGoBack = (window.history.state as { idx?: number } | null)?.idx;
  if (canGoBack) window.history.back();
  else navigate({ name: 'home' }, { replace: true });
}

/**
 * Number each history entry we create, so `goBack` knows whether there is somewhere to go.
 * (`history.length` can't tell: it includes entries from before the app loaded.)
 */
export function useHistoryIndex(): void {
  useEffect(() => {
    if ((window.history.state as { idx?: number } | null)?.idx === undefined) {
      window.history.replaceState({ idx: 0 }, '');
    }
    let last = (window.history.state as { idx: number }).idx;
    const onHashChange = () => {
      const state = window.history.state as { idx?: number } | null;
      if (state?.idx === undefined) {
        last += 1;
        window.history.replaceState({ idx: last }, '');
      } else {
        last = state.idx;
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);
}

/** Desktop back shortcuts: mouse back button, Alt+←, Cmd/Ctrl+[. */
export function useBackShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      const shortcut =
        (e.altKey && e.key === 'ArrowLeft') || ((e.metaKey || e.ctrlKey) && e.key === '[');
      if (shortcut && !typing) {
        e.preventDefault();
        goBack();
      }
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        goBack();
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mouseup', onMouse);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mouseup', onMouse);
    };
  }, []);
}

/**
 * Every screen opens at the top, including when going back: scroll positions aren't carried
 * from one page to the next.
 */
export function useScrollToTop(route: Route): void {
  const key = hrefFor(route);
  useEffect(() => {
    window.history.scrollRestoration = 'manual';
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
