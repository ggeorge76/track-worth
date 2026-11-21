# Architecture Decision Records

We record architecturally significant decisions as [MADR 4](https://adr.github.io/madr/) files.
See [ADR-0001](0001-record-architecture-decisions.md) for the process. To add one, copy
[`template.md`](template.md) (or use the `/new-adr` skill), use the next number, and add it to
this index. Accepted ADRs are immutable. Supersede them with a new ADR instead of editing them.

| ADR                                                      | Title                                                               | Status   |
| -------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)            | Record architecture decisions in ADRs                               | Accepted |
| [0002](0002-technology-stack.md)                         | Technology stack: Tauri 2 + React/TypeScript/Vite, managed with Bun | Accepted |
| [0003](0003-local-desktop-app-no-backend.md)             | Local desktop app with no TrackWorth server                         | Accepted |
| [0004](0004-google-oauth-desktop-loopback-pkce.md)       | Google OAuth in the system browser, refresh token in OS keychain    | Accepted |
| [0005](0005-google-drive-json-file-storage.md)           | One JSON file at a fixed path in the user's Google Drive            | Accepted |
| [0006](0006-data-file-schema-and-migrations.md)          | Versioned data-file schema with forward-only migrations             | Accepted |
| [0007](0007-user-confirmed-updates-from-github.md)       | User-confirmed, signed self-updates from the latest GitHub Release  | Accepted |
| [0008](0008-desktop-distribution-via-github-releases.md) | Distribute desktop installers through GitHub Releases               | Accepted |
| [0009](0009-android-via-tauri-mobile.md)                 | Android app via Tauri 2 mobile                                      | Accepted |
| [0010](0010-versioning-and-release.md)                   | SemVer via Conventional Commits and release-please                  | Accepted |
| [0011](0011-testing-strategy-and-quality-gates.md)       | Testing strategy and automated quality gates                        | Accepted |
| [0012](0012-ai-agent-development-workflow.md)            | AI-agent-first development workflow                                 | Accepted |
