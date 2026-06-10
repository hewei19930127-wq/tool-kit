# Translate Tool — Design Spec

**Date:** 2026-06-10
**Status:** Approved for planning
**Revised:** 2026-06-10 — incorporates all fixes from the design review
(`2026-06-10-translate-tool-design-review.html`): smart flip moved client-side (option A),
`finish_reason`-based truncation handling, and the detected-category → language-id mapping table.

## Overview

Add an LLM-powered Translate tool to ToolKit. The user selects a source and target language
(typically Chinese ↔ English), picks a translation style, and the text is translated by an
OpenAI-compatible LLM provider — DeepSeek by default — with the result streaming into the output
pane. Provider, endpoint, model, and API key are configured in Settings.

This is the app's first networked tool. The offline rule in `AGENTS.md` gets a documented
exception: network calls happen only from this tool and only to the user-configured provider
endpoint (enforced by app-level code; see Native side).

## Decisions

| Topic           | Decision                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Providers       | Presets for DeepSeek (default) and OpenAI, plus a Custom OpenAI-compatible endpoint URL (covers Qwen, Kimi, Ollama, …). One Chat Completions SSE implementation.                                                                    |
| Endpoint URL    | Provider config stores the full chat completions endpoint URL, not an API root. Preset endpoints are fixed/read-only; Custom is user-editable.                                                                                      |
| DeepSeek models | `deepseek-v4-flash` (default) and `deepseek-v4-pro`, selectable in Settings. Invalid persisted values fall back to flash.                                                                                                           |
| API key storage | `toolkit.json` via the existing KV abstraction (plaintext at rest — accepted, same risk level as `~/.aws/credentials`). Settings must state this clearly.                                                                           |
| Styles          | Six fixed presets: General, Formal, Casual, Technical, Literal, Polish. No custom styles in v1.                                                                                                                                     |
| Smart flip      | Decided client-side by the script heuristic (with an English-likeness check for Latin text); the prompt always receives the resolved source/target. When uncertain, no flip.                                                        |
| Trigger         | Explicit Translate button + Cmd/Ctrl+Enter within the Translate tool. No auto-translate on typing.                                                                                                                                  |
| Output          | Token-by-token streaming with a Stop control. User Stop is not an error; timeout/network/provider failures render inline errors. `finish_reason: length` surfaces a truncation warning; truncated runs are not recorded in history. |
| HTTP transport  | `tauri-plugin-http` fetch (bypasses WebView CORS); browser `fetch` fallback for `npm run dev` is best-effort and only works for CORS-allowed/local endpoints.                                                                       |
| Input size      | Inputs over 20,000 characters require a confirmation before sending. v1 does not split or batch long translations.                                                                                                                  |
| Layout          | DeepL-style: each pane carries its own language selector as a header; style + Translate in a slim bar above. Narrow windows stack panes and collapse the style control into a dropdown.                                             |

## Tool UX

Layout (inside the standard detail pane):

- **Top bar:** style segmented control (General / Formal / Casual / Technical / Literal / Polish),
  then right-aligned: history button (standard component) and the Translate button (`⌘↵`). While a
  translation runs, the Translate button becomes **Stop**. On narrow windows the style segmented
  control collapses into a dropdown so the bar never overflows.
- **Two panes**, side by side on wider windows and stacked on narrow windows, with a swap button
  (⇄) between them:
  - **Source pane:** language selector in the pane header (defaults to **Auto-detect**), text
    area below, footer with character count and a clear (✕) action.
  - **Target pane:** language selector in the pane header (defaults to **English**), read-only
    output below, copy action in the header, footer showing stream status (`● streaming…` /
    `stopped` / `done`) on the left and the active model label (e.g. `deepseek-v4-flash`, from the
    run snapshot) on the right. The model label is read-only status text, not a link or button.
    The status clears when a new run starts or the output is cleared. When a smart flip occurred,
    the pane header shows a display-only flip hint next to the selector (e.g. `⇄ 中文（简体）`);
    the selectors themselves are never changed automatically.

### Languages

Menu: Auto-detect (source only), English, Chinese (Simplified), Chinese (Traditional), Japanese,
Korean, French, German, Spanish, Russian. The list is a UI constant — the LLM imposes no limit, so
extending it later is a one-line change.

Each entry is `{ id, label, promptName }` with BCP-47-style ids (`auto`, `en`, `zh-Hans`,
`zh-Hant`, `ja`, `ko`, `fr`, `de`, `es`, `ru`); `label` is the native-script menu text and
`promptName` the English name used when building the prompt (e.g. "Simplified Chinese").

The script heuristic's coarse categories map to language ids as follows — this single mapping is
used by both smart flip and swap: Chinese → `zh-Hans`, Japanese → `ja`, Korean → `ko`, Russian →
`ru`, Latin → `en` (subject to the English-likeness check, see Smart flip), Unknown → no mapping.
The heuristic never tries to tell Simplified from Traditional Chinese — shared characters make
that unreliable — so Traditional Chinese users select it explicitly.

### Behavior

- **Smart flip (client-side):** with source = Auto, the client — not the model — decides the flip.
  Before each request the script heuristic detects the input's category and maps it to a language
  id (see Languages). If that id equals the selected target, the effective target becomes the
  alternate language — Chinese (Simplified) when the target is English, English otherwise — so
  daily zh↔en use needs no dropdown changes in either direction. Because Latin text is not
  necessarily English, Latin only counts as matching an English target when a lightweight
  English-likeness check (English stop-word ratio) passes; when the heuristic is uncertain
  (Unknown category, or the check fails), no flip happens and the request proceeds with the
  selected target. The prompt always receives the resolved source/target and contains no flip
  instructions. Smart flip only applies when source is Auto; explicit source/target selections
  are treated as user intent and are never reversed. Known limit: the heuristic cannot tell
  Simplified from Traditional, so Traditional input with a Simplified target is read as "already
  in the target language" and flips to English — users doing Hans↔Hant conversion should set an
  explicit source.
- **Polish exception:** the Polish style means "translate to the target language, then improve
  wording". When the client-side flip logic determines the Auto-detected input already matches
  the target language, Polish does not flip — the request becomes same-language polishing in the
  target language. Polish may improve clarity, naturalness, and professional tone, but must not
  add facts, remove constraints, or change numbers, amounts, code, API names, error codes, or
  proper nouns.
- **Same language:** explicitly selecting source = target is allowed. For Polish it performs
  same-language polishing; for every other style the Translate button is disabled with a short
  hint, since same-language "translation" has no meaning. Auto never counts as equal — the flip
  logic covers that case.
- **Detection hint:** the source pane header shows `detected: <language>` from the same
  client-side script heuristic that drives smart flip and swap. The heuristic reports coarse
  categories only — Chinese/Japanese/Korean/Russian/Latin/Unknown — plus the English-likeness
  check for Latin text; it never subdivides Latin into French/German etc. Category display names
  are i18n strings.
- **Swap (⇄):** behavior depends on whether output from a completed or stopped run is present:
  - **With output:** the input is replaced by the last output (the previous input is discarded —
    it is not recorded anywhere), output/status are cleared, and the selectors are set from the
    run snapshot's effective languages: new source = effective target, new target = effective
    source. If the effective source is unknown (source was Auto and detection failed), swap is
    disabled.
  - **Without output:** swap only exchanges the two selectors; the input is preserved. If source
    is Auto, the new target comes from the heuristic mapping of the current input; if no mapping
    is available (empty input or Unknown), swap is disabled.

  Swap is disabled while streaming. Partial output from a stopped run counts as output and may be
  swapped into the input.

- **Trigger:** Translate button or Cmd+Enter/Ctrl+Enter while focus is inside the Translate tool.
  The button is disabled when the input is empty. While a run is active, the button becomes Stop
  and Cmd/Ctrl+Enter triggers Stop too, matching the button. Stop aborts the request; partial
  output stays in the pane marked `stopped`.
- **Run snapshot:** each request captures the input, the selected and **effective** (post-flip)
  languages, style/provider config, endpoint, and model at start. During streaming, source text
  may still be edited for the next request, but language/style/swap/provider-related controls are
  disabled.
- **Output lifetime:** editing source text does not clear the previous output. Starting a new
  translation clears output/status. The source clear action clears input, output, and status;
  while streaming it stays enabled but clears only the input, leaving the in-flight output and
  status untouched.
- **Copy:** target copy is enabled whenever visible output is non-empty, including partial output
  after Stop, stall, or truncation. Copy copies only the translation text, never an error banner.
- **Long input:** if input exceeds 20,000 characters, clicking Translate shows a confirmation before
  any network request is sent.
- **History:** standard `useHistory` ring buffer (20 entries); record input → output only on
  successful, untruncated completion — runs that end in Stop, stall, or `finish_reason: length`
  are not recorded. The recorded input is the request-start snapshot, not whatever is currently
  in the textarea at completion time. `pushHistory` dedupes by input, so re-translating the same
  text with a different target/style keeps only the most recent entry — accepted. Restoring
  history only restores the source input; language, style, provider, and previous output are not
  restored.
- **Persistence:** input text via `useToolInput("translate")` is session-only — it survives tool
  switches but, like other tools' inputs, is not persisted across restarts. Language and style
  selections and provider settings live in the translate slice and persist across restarts.
- **No `detectClipboard`:** any text is "translatable", so a clipboard banner would fire on
  everything.

## Settings UX

New **Translation (AI)** section in `Settings.tsx`, following the existing card style. Place it
after Appearance and before Global hotkey.

- **Provider:** segmented control — DeepSeek / OpenAI / Custom.
- **Per provider:** an API key field (password-style input with Eye/EyeOff reveal toggle), model
  control, and endpoint URL display/input:
  - DeepSeek: dropdown `deepseek-v4-flash` (default) | `deepseek-v4-pro`; endpoint URL fixed and
    read-only as `https://api.deepseek.com/chat/completions`.
  - OpenAI: model text field (default `gpt-5.2`, editable); endpoint URL fixed and read-only as
    `https://api.openai.com/v1/chat/completions`.
  - Custom: full endpoint URL text field + model text field; key optional (local Ollama needs none).
    Example local endpoint: `http://localhost:11434/v1/chat/completions`.
- Each provider keeps its own key/model so switching providers loses nothing. Custom also keeps its
  own endpoint URL.
- DeepSeek/OpenAI require an API key before sending a request. Custom may send without an API key;
  when key is blank, the client omits the `Authorization` header. Custom does require a model
  name — a blank Custom model blocks sending with a setup hint, like a missing preset key.
- Settings must state that API keys are stored locally in ToolKit settings in plaintext. The app
  must not log API keys or include them in errors, history, or tests.

## Architecture

New tool folder `src/tools/translate/` following the plugin pattern:

| File                                          | Responsibility                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `translate.ts`                                | Pure logic, no I/O: style preset definitions (prompt instructions), language list and the detected-category → id mapping, `buildMessages(text, source, target, style)`, client-side smart-flip resolution (heuristic + English-likeness check, returning the effective source/target), script-heuristic language detector, SSE chunk parser (deltas and `finish_reason`), endpoint validation, HTTP/stream error normalization to `ToolResult` errors. |
| `client.ts`                                   | Streaming client: takes provider config + messages, `POST endpointUrl` with `stream: true` (OpenAI Chat Completions protocol; DeepSeek speaks it natively), yields text deltas as an async iterator, cancellable via `AbortController`. Uses `fetch` from `tauri-plugin-http` when running in Tauri (via the `isTauri` helper in `src/core/services/runtime.ts`), browser `fetch` otherwise.                                                           |
| `TranslateTool.tsx`                           | UI as described above. Renders streaming text itself; error states reuse the visual language of `OutputPane`.                                                                                                                                                                                                                                                                                                                                          |
| `index.ts`                                    | `Tool` definition: id `translate`, Lucide `Languages` icon, i18n name/keywords keys, no `detectClipboard`.                                                                                                                                                                                                                                                                                                                                             |
| `translate.test.ts`, `TranslateTool.test.tsx` | Tests (see Testing).                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Requests do not set `temperature`, `max_tokens`, `top_p`, or other sampling parameters — provider
defaults apply; register and tone are the style presets' job. The flip side of not setting
`max_tokens` is that provider default output caps apply to long translations; truncation is
detected via `finish_reason: length` and surfaced as a warning (see Error handling) rather than
prevented.

Prompt construction uses exactly two messages:

```ts
[
  { role: "system", content: "..." },
  { role: "user", content: inputText },
];
```

The system message contains the resolved source/target (after client-side smart flip) and style
instructions — no flip logic reaches the model — and must say to treat the user message purely as
source text, not as instructions to follow. When source is Auto and the heuristic is uncertain,
the system message asks the model to translate from whatever language the text is in. The user
message contains only the raw input. Prompts require the model to return only the
translated/polished text: no explanations, no quotes, no markdown fences, and no prefixes/suffixes
unless they were part of the source text. Preserve the source text's paragraphs, line breaks, and
list structure where practical.

The streaming protocol is intentionally narrow: v1 supports OpenAI-compatible Chat Completions SSE
only. Parse `data: ...` events, `[DONE]`, `choices[0].delta.content`, and
`choices[0].finish_reason`; ignore role, reasoning-content fields, tool calls, and additional
choices. Ignored data still counts as stream liveness — it resets the stall timer (see Error
handling); "ignored" means not rendered, not dead air. Responses API, native Anthropic, native
Gemini, and non-streaming JSON fallbacks are out of scope.

### State & persistence

The Zustand store gains a `translate` slice, hydrated/persisted through the existing storage path
(like the diff slice — this includes wiring the slice into the `hydrate` call and the persistence
subscription in `App.tsx`):

```ts
type ProviderId = "deepseek" | "openai" | "custom";

interface ProviderConfig {
  apiKey: string;
  model: string;
  endpointUrl: string; // full chat completions endpoint URL
}

interface TranslateSlice {
  source: string; // language id or "auto"
  target: string; // language id
  style: StyleId; // "general" | "formal" | "casual" | "technical" | "literal" | "polish"
  provider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
}
```

Add `makeDefaultTranslateSlice()` and `normalizeTranslateSlice()` following the diff slice pattern.
Unknown provider/style/language values fall back to defaults; preset endpoint URLs are always reset
to their fixed defaults on hydrate; DeepSeek model values outside the allowed enum fall back to
`deepseek-v4-flash`. OpenAI/Custom model and Custom endpoint/key values are preserved as strings
when present, where blank strings count as absent: a blank OpenAI model falls back to `gpt-5.2` on
hydrate; a blank Custom model is preserved but blocks sending with a setup hint (see Error
handling).

Transient run state (streaming text, pending flag, detected language, the run snapshot with
effective languages) stays in component state — it is not persisted.

### Native side

No new Rust code of our own; Rust stays thin:

- Add the `tauri-plugin-http` dependency and register it in `lib.rs`.
- Scope its permission in `src-tauri/capabilities/default.json` to `https://**` plus
  `http://localhost:*` and `http://127.0.0.1:*` (local Ollama).
- The app-level policy still rejects non-HTTPS Custom endpoints except loopback HTTP
  (`localhost`/`127.0.0.1`). Note the layering: the capability is necessarily broad (Custom
  endpoints rule out a narrower static scope); the "only the user-configured endpoint" guarantee
  lives in app code.

### i18n

All new UI strings get keys in `src/core/i18n/messages/en.ts` and `zh-CN.ts` (tool name
"Translate" / "翻译", style names, settings labels, error messages). Language names in the
selectors render in their own script (中文（简体）, 日本語, …), the convention translation UIs use,
so they are constants rather than i18n keys — with two exceptions: the Auto-detect entry has no
native script and is an i18n key ("Auto-detect" / "自动检测"), and the detection-hint category
names (Chinese, Latin, Unknown, …) are i18n keys as well.

### Data flow

Translate click → validate config/input → confirm if input is over 20,000 chars → resolve
effective source/target (heuristic mapping + smart flip) → capture request snapshot →
`buildMessages()` → `client.ts` streams deltas → UI appends to the output pane → on stream end,
check `finish_reason` — `length` renders a truncation warning and skips history → on successful
completion, record snapshot input → final output in history.

## Error handling

The client never throws into the UI; every failure becomes a `ToolResult`-shaped error rendered
inline in the output pane. When partial output exists, the error renders as a banner below the
text without replacing it; Copy copies only the translation text, never the error.

- **No API key configured:** setup hint pointing the user to Settings instead of an error dump.
  The same setup-hint treatment covers a blank Custom model.
- **HTTP errors mapped to readable messages:** 401 invalid key, 402 insufficient balance
  (DeepSeek), 429 rate limited, 5xx provider unavailable. A short provider-supplied error message
  is surfaced when present.
- **Provider error body:** extract short human-readable fields only (`error.message`, `message`,
  `detail`, or plain text), truncate to 500 characters, and avoid dumping full JSON/HTML bodies.
- **Network failure:** generic "couldn't reach provider" message.
- **Stream stall:** two thresholds — abort if the first byte takes more than 90 seconds (large
  prompts and local models can be slow to start), or if more than 30 seconds pass between chunks
  after that. Any received SSE data resets the timer, including comment/keep-alive lines and
  fields the parser otherwise ignores (e.g. reasoning-content deltas). Existing partial output
  stays visible but is not recorded in history.
- **Output truncation:** `finish_reason: length` means the provider's output cap cut the
  translation short. The partial output stays visible with a truncation warning; the run is not
  recorded in history.
- **User Stop:** not an error — partial output stays, footer shows `stopped`.
- **Empty input:** button disabled; no request fired.
- **Invalid endpoint:** Custom endpoint must be full `https://...` or loopback `http://localhost:*`
  / `http://127.0.0.1:*`.

## Testing

- `translate.test.ts` (bulk of coverage, pure logic): prompt builder across languages and styles,
  including Polish; smart-flip resolution — now fully client-side and deterministic — covering the
  category → id mapping, the English-likeness check, the Polish exception, and the
  uncertain-detection no-flip fallback; same-language rules; script-heuristic detector; endpoint
  validation; SSE parser edge cases (deltas split across chunk boundaries, `[DONE]`, malformed
  lines, ignored fields, `finish_reason: stop` vs `length`); error normalization. Normal, empty,
  Unicode, and large inputs per repo convention.
- `client.ts` against a mocked `fetch` returning scripted `ReadableStream`s: happy-path streaming,
  401, first-byte and inter-chunk timeouts (including that ignored/keep-alive chunks reset the
  stall timer), user abort, and Custom request without an API key.
- `TranslateTool.test.tsx` smoke test with a mocked client: render, type, translate, streamed text
  appears; Stop leaves partial output; clear resets input/output; long input confirmation gates the
  request; a `length` finish reason shows the truncation warning.
- Manual verification via `npm run tauri dev` with a real DeepSeek key (streaming over the real
  plugin is the one path automation does not cover).

## Documentation changes

- `AGENTS.md`: update the Security & Configuration section ("intended to work offline") to record
  the exception precisely: the Tauri capability necessarily allows `https://**` plus loopback HTTP
  (Custom endpoints make a narrower static scope impossible), and the "network calls only from the
  Translate tool, only to the user-configured provider endpoint" guarantee is enforced by
  app-level code, not by the capability. Update the tool count/list in Project Context.

## Out of scope (v1)

- Custom user-defined styles.
- macOS Keychain storage for API keys.
- Auto-translate on typing pause.
- Batch / file translation; translation memory beyond the standard history buffer.
- Non-OpenAI-compatible protocols (Anthropic, Gemini native APIs).
- Distinguishing Simplified vs Traditional Chinese in the script heuristic.
