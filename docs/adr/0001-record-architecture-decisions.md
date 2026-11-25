---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# Record architecture decisions in ADRs

## Context and Problem Statement

TrackWorth will be built almost entirely by AI coding agents working in separate sessions with
no shared memory. Every session needs to know _why_ the system is shaped the way it is. If it
doesn't, agents will "fix" deliberate decisions (for example, keeping tokens out of localStorage)
or reopen settled debates.

## Decision Drivers

- Agents have no memory between sessions. The repo is the only durable context.
- Decisions must be reviewable in PRs, like code.
- The format should be lightweight and widely recognised, so models already know it.

## Considered Options

- Markdown ADRs in the repo using MADR 4
- A wiki or external docs tool
- Comments in code only

## Decision Outcome

Chosen option: **MADR 4 ADRs in `docs/adr/`**, numbered `NNNN-kebab-title.md`, indexed in
`docs/adr/README.md`, created from `docs/adr/template.md` (or the `/new-adr` skill).

Rules:

- Write an ADR for decisions that are hard to reverse or that constrain future work, such as
  framework-level dependencies, storage, auth, security, data format, release and
  distribution.
- ADRs are immutable once accepted. To change a decision, write a new ADR that supersedes it,
  and only update the old one's status line.
- Agents may draft ADRs with status `Proposed`. Only the project owner accepts them.

### Consequences

- Good, because agents and humans get the "why" from the same version-controlled source.
- Good, because MADR is common in training data, so agents read and write it well.
- Bad, because it adds a small amount of process to significant changes.

### Confirmation

PR template and AGENTS.md require linking an ADR when a change alters an architectural decision.

## More Information

- MADR: https://adr.github.io/madr/
- Michael Nygard, "Documenting Architecture Decisions" (2011)
