# Translate Tool — Design Spec

**Date:** 2026-06-10
**Status:** Approved for planning

## Overview

Add an LLM-powered Translate tool to ToolKit. The user selects a source and target language
(typically Chinese ↔ English), picks a translation style, and the text is translated by an
OpenAI-compatible LLM provider — DeepSeek by default — with the result streaming into the output
pane. Provider and API key are configured in Settings.

This is the app's first networked tool. The offline rule in `AGENTS.md` gets a documented
exception: network calls happen only from this tool and only to the user-configured provider
endpoint.

## Decisions

| Topic           | Decision                                                                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Providers       | Presets for DeepSeek (default) and OpenAI, plus a Custom OpenAI-compatible endpoint (covers Qwen, Kimi, Ollama, …). One protocol implementation. |
| DeepSeek models | `deepseek-v4-flash` (default) and `deepseek-v4-pro`, selectable in Settings.                                                                     |
| API key storage | `toolkit.json` via the existing KV abstraction (plaintext at rest — accepted, same risk level as `~/.aws/credentials`).                          |
| Styles          | Five fixed presets: General, Formal, Casual, Technical, Literal. No custom styles in v1.                                                         |
| Trigger         | Explicit Translate button + Cmd+Enter. No auto-translate on typing.                                                                              |
| Output          | Token-by-token streaming with a Stop control.                                                                                                    |
| HTTP transport  | `tauri-plugin-http` fetch (bypasses WebView CORS); browser `fetch` fallback for `npm run dev`.                                                   |
| Layout          | DeepL-style: each pane carries its own language selector as a header; style + Translate in a slim bar above.                                     |

## Tool UX

Layout (inside the standard detail pane):

- **Top bar:** style segmented control (General / Formal / Casual / Technical / Literal), then
  right-aligned: history button (standard component) and the Translate button (`⌘↵`). While a
  translation runs, the Translate button becomes **Stop**.
- **Two panes side by side**, swap button (⇄) between them:
  - **Source pane:** language selector in the pane header (defaults to **Auto-detect**), text
    area below, footer with character count and a clear (✕) action.
  - **Target pane:** language selector in the pane header (defaults to **English**), read-only
    output below, copy action in the header, footer showing stream status (`● streaming…` /
    `stopped`) on the left and the active model label (e.g. `deepseek-v4-flash`) on the right.
    Clicking the model label opens Settings.

### Languages

Menu: Auto-detect (source only), English, Chinese (Simplified), Chinese (Traditional), Japanese,
Korean, French, German, Spanish, Russian. The list is a UI constant — the LLM imposes no limit, so
extending it later is a one-line change.

Each entry is `{ id, label, promptName }` with BCP-47-style ids (`auto`, `en`, `zh-Hans`,
`zh-Hant`, `ja`, `ko`, `fr`, `de`, `es`, `ru`); `label` is the native-script menu text and
`promptName` the English name used when building the prompt (e.g. "Simplified Chinese").

### Behavior

- **Smart flip:** with source = Auto, the prompt instructs the model: if the text is already in
  the target language, translate to the alternate language instead — Chinese (Simplified) when the
  target is English, English otherwise. Daily zh↔en use therefore needs no dropdown changes in
  either direction.
- **Detection hint:** the source pane header shows `detected: <language>` from a lightweight
  client-side script heuristic (Han/kana/hangul/Latin character classes). Display-only; the
  smart-flip decision belongs to the model.
- **Swap (⇄):** exchanges the two language selections and moves the last translation into the
  input. While source is Auto, swap uses the heuristic-detected language if available, otherwise
  it is disabled.
- **Trigger:** Translate button or Cmd+Enter. Disabled when the input is empty or a run is active.
  Stop aborts the request; partial output stays in the pane marked `stopped`.
- **History:** standard `useHistory` ring buffer (20 entries); record input → output only on
  successful completion.
- **Persistence:** input text via `useToolInput("translate")`; language and style selections and
  provider settings persist across restarts like other tools.
- **No `detectClipboard`:** any text is "translatable", so a clipboard banner would fire on
  everything.

## Settings UX

New **Translation (AI)** section in `Settings.tsx`, following the existing card style:

- **Provider:** segmented control — DeepSeek / OpenAI / Custom.
- **Per provider:** an API key field (password-style input) and a model selector:
  - DeepSeek: dropdown `deepseek-v4-flash` (default) | `deepseek-v4-pro`; base URL fixed to
    `https://api.deepseek.com`.
  - OpenAI: model text field (default `gpt-5.2`); base URL fixed to `https://api.openai.com/v1`.
  - Custom: base URL text field + model text field; key optional (local Ollama needs none).
- Each provider keeps its own key/model so switching providers loses nothing.

## Architecture

New tool folder `src/tools/translate/` following the plugin pattern:

| File                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `translate.ts`                                | Pure logic, no I/O: style preset definitions (prompt instructions), language list, `buildMessages(text, source, target, style)`, smart-flip rule, script-heuristic language detector, SSE chunk parser, HTTP/stream error normalization to `ToolResult` errors.                                                                                                                          |
| `client.ts`                                   | Streaming client: takes provider config + messages, `POST {baseUrl}/chat/completions` with `stream: true` (OpenAI protocol; DeepSeek speaks it natively), yields text deltas as an async iterator, cancellable via `AbortController`. Uses `fetch` from `tauri-plugin-http` when running in Tauri (detected via `__TAURI_INTERNALS__`, same as `storage.ts`), browser `fetch` otherwise. |
| `TranslateTool.tsx`                           | UI as described above. Renders streaming text itself; error states reuse the visual language of `OutputPane`.                                                                                                                                                                                                                                                                            |
| `index.ts`                                    | `Tool` definition: id `translate`, Lucide `Languages` icon, i18n name/keywords keys, no `detectClipboard`.                                                                                                                                                                                                                                                                               |
| `translate.test.ts`, `TranslateTool.test.tsx` | Tests (see Testing).                                                                                                                                                                                                                                                                                                                                                                     |

Requests do not set `temperature` or `max_tokens` — provider defaults apply; register and tone are
the style presets' job.

### State & persistence

The Zustand store gains a `translate` slice, hydrated/persisted through the existing storage path
(like the diff slice):

```ts
type ProviderId = "deepseek" | "openai" | "custom";

interface ProviderConfig {
  apiKey: string;
  model: string;
  baseUrl: string; // fixed for presets, editable for custom
}

interface TranslateSlice {
  source: string; // language id or "auto"
  target: string; // language id
  style: StyleId; // "general" | "formal" | "casual" | "technical" | "literal"
  provider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
}
```

Transient run state (streaming text, pending flag, detected language) stays in component state —
it is not persisted.

### Native side

No new Rust code of our own; Rust stays thin:

- Add the `tauri-plugin-http` dependency and register it in `lib.rs`.
- Scope its permission in `src-tauri/capabilities/default.json` to `https://**` plus
  `http://localhost:*` and `http://127.0.0.1:*` (local Ollama).

### i18n

All new UI strings get keys in `src/core/i18n/messages/en.ts` and `zh-CN.ts` (tool name
"Translate" / "翻译", style names, settings labels, error messages). Language names in the
selectors render in their own script (中文（简体）, 日本語, …), the convention translation UIs use,
so they are constants rather than i18n keys.

### Data flow

Translate click → `buildMessages()` → `client.ts` streams deltas → UI appends to the output pane →
on completion, record input → output in history.

## Error handling

The client never throws into the UI; every failure becomes a `ToolResult`-shaped error rendered
inline in the output pane:

- **No API key configured:** setup hint with an "Open Settings" action instead of an error dump.
- **HTTP errors mapped to readable messages:** 401 invalid key, 402 insufficient balance
  (DeepSeek), 429 rate limited, 5xx provider unavailable. The provider's own error message body is
  passed through when present.
- **Network failure:** generic "couldn't reach provider" message.
- **Stream stall:** abort if no chunk arrives for 30 seconds (also covers first-byte timeout).
- **User Stop:** not an error — partial output stays, footer shows `stopped`.
- **Empty input:** button disabled; no request fired.

## Testing

- `translate.test.ts` (bulk of coverage, pure logic): prompt builder across languages and styles,
  smart-flip rule, script-heuristic detector, SSE parser edge cases (deltas split across chunk
  boundaries, `[DONE]`, malformed lines), error normalization. Normal, empty, Unicode, and large
  inputs per repo convention.
- `client.ts` against a mocked `fetch` returning scripted `ReadableStream`s: happy-path streaming,
  401, mid-stream abort.
- `TranslateTool.test.tsx` smoke test with a mocked client: render, type, translate, streamed text
  appears.
- Manual verification via `npm run tauri dev` with a real DeepSeek key (streaming over the real
  plugin is the one path automation does not cover).

## Documentation changes

- `AGENTS.md`: update the Security & Configuration section ("intended to work offline") to record
  the exception — network calls only from the Translate tool, only to the user-configured provider
  endpoint. Update the tool count/list in Project Context.

## Out of scope (v1)

- Custom user-defined styles.
- macOS Keychain storage for API keys.
- Auto-translate on typing pause.
- Batch / file translation; translation memory beyond the standard history buffer.
- Non-OpenAI-compatible protocols (Anthropic, Gemini native APIs).
