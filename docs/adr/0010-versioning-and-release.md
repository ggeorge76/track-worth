---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# SemVer releases driven by Conventional Commits and release-please

## Context and Problem Statement

Agents produce many small PRs. We need consistent version numbers (the update check in ADR-0007
compares them), an accurate changelog and a release process that doesn't depend on someone
remembering steps.

## Considered Options

- Conventional Commits + release-please (release PR model)
- semantic-release (fully automatic on every merge)
- Manual tags and changelog

## Decision Outcome

Chosen option: **Conventional Commits + release-please.**

- Branches: feature branches → PR into `dev` → `dev` merged into `main` to release.
- On `main`, release-please keeps a release PR open that bumps `package.json` and
  `src-tauri/Cargo.toml`, updates `CHANGELOG.md`, and tags `vX.Y.Z` when merged.
  `tauri.conf.json` reads its version from `package.json`. The release workflow then builds
  and uploads the signed desktop installers (ADR-0008), and installed apps offer the update
  (ADR-0007).
- The version is injected into the app as `__APP_VERSION__` and shown in the footer.
- Before 1.0, `feat` bumps the patch version and breaking changes bump the minor version.

### Consequences

- Good, because a human still decides _when_ to release by merging the release PR.
- Good, because agents follow Conventional Commits reliably when told to.
- Bad, because squash-merge titles must follow the convention. Enforce it in review (a PR-title
  lint action can come later).
