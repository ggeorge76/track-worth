---
status: Accepted
date: 2026-11-22
decision-makers: [project owner]
---

# In-app navigation with hash routes and back-button support, no router library

## Context and Problem Statement

The app now has several screens: start page, create account and account details. It needs
navigation between them, including a working **back button** in a browser, on the desktop
(mouse back button, keyboard shortcut) and on Android. Should we add a routing library?

## Decision Drivers

- The owner chose "simple in-app state" but required back-button support.
- Few dependencies (ADR-0002, SOUL.md "When in doubt, leave it out").
- The same UI runs in Tauri desktop, a plain browser (dev, e2e) and later Android.

## Considered Options

1. A tiny built-in router over **URL hash routes** (`#/`, `#/accounts/new`, `#/accounts/<id>`)
2. React Router (or TanStack Router)
3. Pure React state with no URL at all

## Decision Outcome

Chosen option: **1. A tiny hash router** in `src/app/router.ts` (about 80 lines):

- `parseHash` / `hrefFor` convert between the URL hash and a typed `Route` union.
- `useRoute()` subscribes to `hashchange` with `useSyncExternalStore`.
- `navigate(route)` pushes a history entry; `navigate(route, { replace: true })` doesn't.
- `goBack()` uses `history.back()`, falling back to the start page when there is no history.
- **Back everywhere:** every screen change is a real history entry, so the browser back
  button works. Tauri's Android shell maps the system back button to webview history.
  On desktop, `useBackShortcuts()` maps the mouse back button, `Alt+←` and `Cmd/Ctrl+[` to
  `history.back()`.
- Hash routes (instead of path routes) work when the app is loaded from local files inside
  Tauri, with no server-side rewrite rules.

### Consequences

- Good, because there is no dependency, routes are typed, and back works on every platform.
- Bad, because there are no nested layouts, loaders or code splitting. We don't need them
  yet. Revisit with a new ADR if the number of screens grows a lot.

### Confirmation

`src/app/router.test.ts` covers parsing, links, navigation and the back fallback.
