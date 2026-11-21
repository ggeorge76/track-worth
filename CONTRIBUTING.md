# Contributing

Thanks for helping! This project is built mostly by AI agents with human review, so the rules
are written down and enforced by tooling.

1. Read [SOUL.md](SOUL.md) (why) and [AGENTS.md](AGENTS.md) (how). They apply to humans too.
2. Pick or open an issue. Use the **Agent task** template for work meant for an AI agent.
3. Branch from `dev`: `feat/…`, `fix/…`, `docs/…` or `chore/…`.
4. Make a small, focused change, with tests.
5. Run `bun run check` and make sure it passes.
6. Open a PR into `dev` using the template. The PR title must be a
   [Conventional Commit](https://www.conventionalcommits.org/), for example
   `feat(accounts): archive accounts`.
7. CI must be green, and the code owner reviews and merges.

## Local setup

Install [Bun](https://bun.sh), [Rust](https://rustup.rs) and the
[Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Then:

```bash
bun install
cp .env.example .env.local   # Google OAuth Desktop client, see docs/setup/google-cloud.md
bun run app:dev
```

## Architectural changes

If your change alters a decision recorded in `docs/adr/`, or makes a new one (new framework-level
dependency or Tauri plugin, storage, auth, security, capabilities, data format, release), add an
ADR with status `Proposed` in the same PR. See
[ADR-0001](docs/adr/0001-record-architecture-decisions.md).

## Data-file changes

Any change to `src/domain/schema.ts` must bump `SCHEMA_VERSION`, add a migration and add a
fixture test. See [ADR-0006](docs/adr/0006-data-file-schema-and-migrations.md).

## Releases

See [docs/setup/releasing.md](docs/setup/releasing.md).
