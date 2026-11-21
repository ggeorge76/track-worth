---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Testing strategy and automated quality gates

## Context and Problem Statement

With AI agents writing most of the code, automated checks are the main line of defence. Human
review is the second. What must pass before code merges?

## Decision Drivers

- Agents can produce plausible but wrong code, so we need fast, deterministic feedback.
- Google sign-in can't be automated in CI.
- Data correctness matters most (money math, schema, Drive writes).

## Decision Outcome

A testing pyramid with a single command, **`bun run check`**, that agents run locally and CI
runs on every PR:

UI (`check:web`):

1. **Prettier** format check
2. **ESLint** with `typescript-eslint` `strictTypeChecked`
3. **TypeScript** strict typecheck
4. **Vitest** unit and component tests (jsdom + Testing Library). Tauri APIs are mocked with
   `vi.mock('@tauri-apps/...')`.
5. **Vite** production build

Native (`check:rust`):

6. **rustfmt** check
7. **Clippy** (`all` + `pedantic`, `-D warnings`)
8. **cargo test**

Plus **Playwright** E2E smoke tests of the UI in a browser (desktop + mobile-size viewports) for
the signed-out shell. Before each release, a human runs a manual smoke test of the real app:
sign in, load, save, and the update prompt.

Rules:

- `domain/` targets 100% branch coverage.
- `services/` take an injected `fetch`, and tests use fakes. Tests never touch real Google or
  GitHub APIs.
- Rust: pure logic (PKCE, URL building, callback parsing, error mapping) is unit-tested.
  Network-touching functions stay thin.
- Bug fixes start with a failing test.
- Never weaken a gate to get green. Changing a gate requires an ADR.

### Consequences

- Good, because most agent mistakes are caught in seconds.
- Bad, because signed-in end-to-end flows in the real app aren't automated (Tauri WebDriver
  doesn't support macOS, and Google sign-in can't run in CI). We cover them with mocked Tauri
  commands, fakes and a manual pre-release smoke test.

### Confirmation

`.github/workflows/ci.yml`. Branch protection on `main` and `dev` should require the CI checks
(configure in GitHub settings).
