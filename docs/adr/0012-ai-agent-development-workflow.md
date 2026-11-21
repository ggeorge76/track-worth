---
status: Accepted
date: 2026-11-21
decision-makers: [project owner]
---

# AI-agent-first development workflow

## Context and Problem Statement

The project will be developed almost entirely by AI coding agents, possibly from different
vendors. How do we keep quality, consistency and safety high across stateless sessions?

## Decision Drivers

- Agents have no memory between sessions, so context must live in the repo.
- Multiple tools (Claude Code, Codex, Copilot, Cursor, Gemini) should share one source of truth.
- A human owner reviews and merges, so agents need clear limits on what they may do alone.

## Decision Outcome

- **`AGENTS.md`** (agents.md convention) is the single source of operational instructions:
  commands, repo map, conventions, testing rules, boundaries (always / ask first / never) and
  definition of done. Tool-specific files only point to it: `CLAUDE.md` imports it, and
  `.github/copilot-instructions.md` links it.
- **`SOUL.md`** holds the product's purpose, values, taste and non-goals, so agents can make
  judgment calls consistently.
- **ADRs** (ADR-0001) record the _why_ of decisions.
- **`docs/product/requirements.md`** is the source of truth for features. Agents don't invent
  requirements.
- **Issue template "Agent task"** gives one scoped task per issue and per PR, with acceptance
  criteria and out-of-scope lists.
- **Guardrails:** CI gates (ADR-0011), CODEOWNERS review, PR template with an AI disclosure,
  `.claude/settings.json` deny rules (no reading `.env`, no pushing to protected branches) and
  branch protection.
- **Skills:** `.claude/skills/` holds repeatable procedures (`/verify`, `/new-adr`).
- **Tooling guardrails:** `bun test` is blocked with a helpful message (`bunfig.toml`), so agents
  don't accidentally use the wrong test runner.

### Consequences

- Good, because any agent can be productive from a cold start by reading two files.
- Good, because decisions and conventions are versioned and reviewed like code.
- Bad, because these docs need updating as the project evolves, and stale docs mislead agents.
  Rule: a PR that changes a convention updates AGENTS.md in the same PR.
