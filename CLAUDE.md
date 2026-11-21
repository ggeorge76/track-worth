# CLAUDE.md

@AGENTS.md
@SOUL.md

## Claude Code specifics

- Project skills live in `.claude/skills/`. Use `/new-adr` to draft an ADR and `/verify` to run
  the full quality gate and report results.
- Shared permissions are in `.claude/settings.json`. Personal overrides go in
  `.claude/settings.local.json`, which is git-ignored.
- Prefer delegating broad codebase searches to a subagent. Keep the main context for the change
  itself.
