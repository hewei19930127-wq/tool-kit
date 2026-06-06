# Biome Linting & Formatting Setup

**Date:** 2026-06-06
**Status:** Approved

## What

Add Biome as the project's linter and formatter. Biome is a single Rust-based devDependency that handles both lint and format — replacing the current no-tooling state where only `tsc` strict mode enforces quality.

## Why

The project has no style enforcement beyond TypeScript's type checker. A formatter eliminates whitespace noise in diffs; a linter catches React, accessibility, and logic issues that `tsc` misses. Biome is the smallest-footprint option: one package, one config file, fast enough to run on every file change.

## Scope

- `src/` only. `src-tauri/` (Rust), `dist/`, `node_modules/` are excluded.
- No changes to the build pipeline — linting does not block `npm run build`.
- No pre-commit hook automation — the convention is manual: fix before committing.

## Installation

```bash
npm install --save-dev @biomejs/biome
npx biome init
```

## Configuration (`biome.json`)

```json
{
  "$schema": "https://biomejs.dev/schemas/1.x.x/schema.json",
  "files": {
    "include": ["src/**"],
    "ignore": ["dist/**", "node_modules/**"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "organizeImports": {
    "enabled": true
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always"
    }
  }
}
```

## npm Scripts

Four scripts added to `package.json`:

| Script       | Command                     | Purpose                                   |
| ------------ | --------------------------- | ----------------------------------------- |
| `lint`       | `biome check src/`          | One-shot check — CI / before commit       |
| `lint:fix`   | `biome check --write src/`  | Auto-fix lint + format violations         |
| `lint:watch` | `biome check --watch src/`  | Watch mode — re-runs on every file change |
| `format`     | `biome format --write src/` | Format only, no lint rules                |

## Developer Workflow

Run `npm run lint:watch` in a second terminal alongside `npm run dev`. It re-runs Biome on every file change and reports violations inline.

Before committing: run `npm run lint:fix` to auto-fix, then `npm run lint` to confirm zero violations.

## CLAUDE.md Updates

1. Replace the "no ESLint/Prettier/Biome" note in Commands with the four new scripts.
2. Add a **Code Quality** section with the rule: after each change run `npm run lint:fix`; before each commit run `npm run lint`.
