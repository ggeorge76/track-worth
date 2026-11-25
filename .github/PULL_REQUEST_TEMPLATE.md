## What & why

<!-- One or two sentences. Link the issue: "Closes #123". -->

## How

<!-- Key decisions. If this introduces or changes an architectural decision, link the ADR. -->

## Verification

<!-- What you ran and what you saw. Paste the tail of `bun run check`. Did you run the real app (`bun run app:dev`)? Screenshots for UI changes. -->

## Checklist

- [ ] `bun run check` passes locally (UI + Rust)
- [ ] Tests added/updated for changed behaviour
- [ ] Data-file schema unchanged, **or** `SCHEMA_VERSION` bumped with a migration + tests (ADR-0006)
- [ ] No tokens, personal data or real balances in code, logs, fixtures or screenshots
- [ ] No changes to capabilities, CSP, OAuth scopes or updater config, **or** they were approved and documented
- [ ] Docs updated (README / docs / ADR / AGENTS.md) where behaviour or conventions changed
- [ ] PR title follows Conventional Commits (`feat:`, `fix:`, `docs:` …)

## AI disclosure

- [ ] This PR was written (wholly or partly) by an AI agent. Agent/tool: <!-- e.g. Claude Code -->
