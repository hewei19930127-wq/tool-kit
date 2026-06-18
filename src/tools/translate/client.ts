import type { I18nKey, I18nParams } from "@/core/i18n/types";
import { isTauriRuntime } from "@/core/services/runtime";
import { type ChatMessage, createSseParser, extractProviderMessage } from "./translate";

export const FIRST_BYTE_TIMEOUT_MS = 90_000;
export const CHUNK_TIMEOUT_MS = 30_000;

export interface StreamRequest {
  endpointUrl: string;
  /** Blank means "no Authorization header" — Custom endpoints may be keyless. */
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal: AbortSignal;
}

export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; finishReason: string | null }
  | { type: "aborted" }
  | { type: "error"; errorKey: I18nKey; params?: I18nParams; detail?: string };

/** tauri-plugin-http fetch in the native shell (bypasses WebView CORS), browser fetch otherwise. */
async function resolveFetch(): Promise<typeof globalThis.fetch> {
  if (isTauriRuntime()) {
    const plugin = await import("@tauri-apps/plugin-http");
    return plugin.fetch as typeof globalThis.fetch;
  }
  return globalThis.fetch.bind(globalThis);
}

function statusErrorKey(status: number): I18nKey {
  if (status === 401) return "tools.translate.errors.unauthorized";
  if (status === 402) return "tools.translate.errors.balance";
  if (status === 429) return "tools.translate.errors.rateLimited";
  if (status >= 500) return "tools.translate.errors.providerUnavailable";
  return "tools.translate.errors.http";
}

function abortedPromise(signal: AbortSignal): Promise<"aborted"> {
  return new Promise((resolve) => {
    if (signal.aborted) resolve("aborted");
    else
      signal.addEventListener("abort", () => resolve("aborted"), {
        once: true,
      });
  });
}

/**
 * Race an operation against a stall timeout and the caller's abort signal.
 * The abandoned operation's eventual rejection is swallowed so it never
 * becomes an unhandled rejection.
 */
async function raceWithStall<T>(
  operation: Promise<T>,
  timeoutMs: number,
  aborted: Promise<"aborted">,
): Promise<T | "stalled" | "aborted"> {
  void operation.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stalled = new Promise<"stalled">((resolve) => {
    timer = setTimeout(() => resolve("stalled"), timeoutMs);
  });
  try {
    return await Promise.race([operation, stalled, aborted]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Stream an OpenAI-compatible Chat Completions request. Never throws — every
 * outcome, including failures, is yielded as a StreamEvent. The API key goes
 * into the Authorization header only; it is never logged or echoed in events.
 * Stall policy: 90s for the response to start, 30s between chunks after that;
 * ANY received data (keep-alives, ignored fields) resets the window.
 */
export async function* streamChatCompletion(request: StreamRequest): AsyncGenerator<StreamEvent> {
  const controller = new AbortController();
  const onCallerAbort = () => controller.abort();
  request.signal.addEventListener("abort", onCallerAbort, { once: true });
  const aborted = abortedPromise(request.signal);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (request.apiKey !== "") headers.Authorization = `Bearer ${request.apiKey}`;
    const doFetch = await resolveFetch();

    let response: Response;
    try {
      const raced = await raceWithStall(
        doFetch(request.endpointUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: request.model,
            messages: request.messages,
            stream: true,
          }),
          signal: controller.signal,
        }),
        FIRST_BYTE_TIMEOUT_MS,
        aborted,
      );
      if (raced === "aborted") {
        controller.abort();
        yield { type: "aborted" };
        return;
      }
      if (raced === "stalled") {
        controller.abort();
        yield {
          type: "error",
          errorKey: "tools.translate.errors.stallFirstByte",
        };
        return;
      }
      response = raced;
    } catch {
      yield request.signal.aborted
        ? { type: "aborted" }
        : { type: "error", errorKey: "tools.translate.errors.network" };
      return;
    }

    if (!response.ok) {
      let body = "";
      try {
        body = await response.text();
      } catch {
        // Unreadable error body — the status-based message still applies.
      }
      yield {
        type: "error",
        errorKey: statusErrorKey(response.status),
        params: { status: response.status },
        detail: extractProviderMessage(body) ?? undefined,
      };
      return;
    }
    if (!response.body) {
      yield { type: "error", errorKey: "tools.translate.errors.network" };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const parser = createSseParser();
    let finishReason: string | null = null;
    let timeoutMs = FIRST_BYTE_TIMEOUT_MS;
    let stallKey: I18nKey = "tools.translate.errors.stallFirstByte";

    while (true) {
      let raced: ReadableStreamReadResult<Uint8Array> | "stalled" | "aborted";
      try {
        raced = await raceWithStall(reader.read(), timeoutMs, aborted);
      } catch {
        yield request.signal.aborted
          ? { type: "aborted" }
          : { type: "error", errorKey: "tools.translate.errors.network" };
        return;
      }
      if (raced === "aborted") {
        controller.abort();
        void reader.cancel().catch(() => {});
        yield { type: "aborted" };
        return;
      }
      if (raced === "stalled") {
        controller.abort();
        void reader.cancel().catch(() => {});
        yield { type: "error", errorKey: stallKey };
        return;
      }
      // Any received chunk — parsed or ignored — resets the stall window.
      timeoutMs = CHUNK_TIMEOUT_MS;
      stallKey = "tools.translate.errors.stallChunk";
      if (raced.done) break;
      const chunk = parser.push(decoder.decode(raced.value, { stream: true }));
      if (chunk.finishReason !== null) finishReason = chunk.finishReason;
      for (const delta of chunk.deltas) yield { type: "delta", text: delta };
      if (chunk.done) break;
    }
    yield { type: "done", finishReason };
  } finally {
    request.signal.removeEventListener("abort", onCallerAbort);
  }
}
