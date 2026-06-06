# CLAUDE.md

**[`AGENTS.md`](./AGENTS.md) is the single source of truth for this repository — read it first and
follow everything in it.** It covers project context, structure, architecture (the tool plugin
pattern, the `ToolResult` contract, state/services, the size-aware transform pipeline, and the
native Rust boundary), build/test commands, coding style, testing, and commit/PR rules. To avoid
drift, none of that is restated here; this file holds only Claude Code-specific notes.

## Claude Code working notes

- **Easiest `AGENTS.md` rules to violate — verify on every change:** the lint loop
  (`npm run lint:fix` after each change, `npm run lint` before each commit), the `ToolResult`
  contract (pure transforms never throw into the UI), and `@/*` alias sync across `tsconfig.json`,
  `vite.config.ts`, and `vitest.config.ts`.
- **Before large changes,** consult the authoritative design spec
  `docs/superpowers/specs/2026-06-06-toolkit-design.md` and the phased plans under
  `docs/superpowers/plans/`.
- **Add future Claude Code-specific guidance here** (workflow preferences, agent conventions) —
  keep all shared, agent-agnostic rules in `AGENTS.md` so the two never diverge.
