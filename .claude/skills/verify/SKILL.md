---
name: verify
description: Run the full TrackWorth quality gate (UI + Rust, and e2e when the UI shell changed) and report the real results. Use before declaring any task done or before opening a PR.
---

# Verify

1. Run `bun run check` (format, lint, typecheck, Vitest, Vite build, rustfmt, Clippy, cargo test).
   Capture the result. Never use `bun test`.
2. If anything under `src/App.tsx`, `src/features/`, `index.html`, `vite.config.ts` or `e2e/`
   changed, also run `bun run test:e2e`. If Playwright browsers are missing, run
   `bunx playwright install chromium` first.
3. If `src-tauri/` changed, also confirm the app still starts: `bun run app:build --debug`
   (or `bun run app:dev` if a display is available).
4. If something fails, fix the root cause and rerun. Do not disable rules, skip tests, add
   `#[allow]`, or loosen types to get a pass.
5. Report what you ran, pass/fail for each step, and the relevant tail of any failure output.
   Never claim success without having seen it.
