# ToolKit

Native macOS developer toolbox built with Tauri 2, React, TypeScript, Vite,
Tailwind CSS, shadcn-style primitives, Zustand, and Vitest.

This foundation implements the app shell, tool registry, persistent app state,
per-tool history infrastructure, clipboard detection, the command palette, and a
working JSON tool.

## Commands

```bash
npm run dev
npm test
npm run build
npm run tauri dev
```

`npm run tauri dev` requires Rust/Cargo on `PATH`. Install Rust first with
`rustup` if `cargo --version` fails.
