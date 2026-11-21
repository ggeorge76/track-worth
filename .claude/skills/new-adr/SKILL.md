---
name: new-adr
description: Draft a new Architecture Decision Record in docs/adr using the project's MADR template. Use when a change introduces or alters an architectural decision (new framework-level dependency, storage, auth, security, release or data-format change).
---

# Draft a new ADR

1. Read `docs/adr/README.md` and the existing ADRs to avoid duplicates and to find any ADR this one
   supersedes.
2. Pick the next number: highest existing `NNNN` + 1, zero-padded to 4 digits.
3. Copy `docs/adr/template.md` to `docs/adr/NNNN-kebab-case-title.md`.
4. Fill it in:
   - Status: `Proposed` (only the human owner moves it to `Accepted`).
   - Date: today, `YYYY-MM-DD`.
   - At least two considered options, with honest pros and cons, including "do nothing" when
     that's realistic.
   - Consequences: include the negative ones.
   - Check the decision against SOUL.md principles and say so explicitly.
5. If it supersedes an ADR, set the old one's status to `Superseded by ADR-NNNN` (and nothing
   else in it).
6. Add a row to the index table in `docs/adr/README.md`.
7. Run `bunx prettier --write docs/adr` and report the file path.
