import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHUNK_TIMEOUT_MS,
  FIRST_BYTE_TIMEOUT_MS,
  type StreamEvent,
  streamChatCompletion,
} from "./client";
import type { ChatMessage } from "./translate";

const MESSAGES: ChatMessage[] = [
  {
    role: "system",
    content: "You translate. Translate the user's text into English.",
  },
  { role: "user", content: "你好" },
];

function baseRequest(signal?: AbortSignal) {
  return {
    endpointUrl: "https://api.deepseek.com/chat/completions",
    apiKey: "test-key",
    model: "deepseek-v4-flash",
    messages: MESSAGES,
    signal: signal ?? new AbortController().signal,
  };
}

function sseResponse(payload: string): Response {
  return new Response(payload, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Stream that enqueues each step at its `at` offset — drive with fake timers. */
function scriptedStream(
  steps: { at: number; data?: string; close?: boolean }[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const step of steps) {
        setTimeout(() => {
          if (step.data !== undefined) controller.enqueue(encoder.encode(step.data));
          if (step.close) controller.close();
        }, step.at);
      }
    },
  });
}

async function collect(events: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  const all: StreamEvent[] = [];
  for await (const event of events) all.push(event);
  return all;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("streamChatCompletion", () => {
  it("streams deltas and finishes with the finish reason", async () => {
    const body = [
      'data: {"choices":[{"delta":{"role":"assistant"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":"Hel"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{"content":"lo"},"finish_reason":null}]}',
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}',
      "data: [DONE]",
      "",
    ].join("\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(sseResponse(body)));

    const events = await collect(streamChatCompletion(baseRequest()));

    expect(events).toEqual([
      { type: "delta", text: "Hel" },
      { type: "delta", text: "lo" },
      { type: "done", finishReason: "stop" },
    ]);
  });

  it("sends a Bearer header only when a key is set", async () => {
    const fetchMock = vi.fn().mockResolvedValue(sseResponse("data: [DONE]\n"));
    vi.stubGlobal("fetch", fetchMock);

    await collect(streamChatCompletion(baseRequest()));
    let init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "deepseek-v4-flash",
      messages: MESSAGES,
      stream: true,
    });

    fetchMock.mockClear();
    fetchMock.mockResolvedValue(sseResponse("data: [DONE]\n"));
    await collect(streamChatCompletion({ ...baseRequest(), apiKey: "" }));
    init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("maps a 401 with a provider message to a readable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"Invalid API key provided"}}', {
          status: 401,
        }),
      ),
    );

    const events = await collect(streamChatCompletion(baseRequest()));

    expect(events).toEqual([
      {
        type: "error",
        errorKey: "tools.translate.errors.unauthorized",
        params: { status: 401 },
        detail: "Invalid API key provided",
      },
    ]);
  });

  it("maps a network failure to the network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const events = await collect(streamChatCompletion(baseRequest()));
    expect(events).toEqual([{ type: "error", errorKey: "tools.translate.errors.network" }]);
  });

  it("stalls when the provider sends nothing for 90 seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(new Promise<Response>(() => {})));

    const pending = collect(streamChatCompletion(baseRequest()));
    await vi.advanceTimersByTimeAsync(FIRST_BYTE_TIMEOUT_MS);

    expect(await pending).toEqual([
      { type: "error", errorKey: "tools.translate.errors.stallFirstByte" },
    ]);
  });

  it("stalls after 30 silent seconds between chunks", async () => {
    vi.useFakeTimers();
    const stream = scriptedStream([
      {
        at: 0,
        data: 'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n',
      },
      // then silence forever
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

    const pending = collect(streamChatCompletion(baseRequest()));
    await vi.advanceTimersByTimeAsync(CHUNK_TIMEOUT_MS + 1_000);

    expect(await pending).toEqual([
      { type: "delta", text: "Hi" },
      { type: "error", errorKey: "tools.translate.errors.stallChunk" },
    ]);
  });

  it("keep-alive comments reset the inter-chunk stall timer", async () => {
    vi.useFakeTimers();
    const stream = scriptedStream([
      {
        at: 0,
        data: 'data: {"choices":[{"delta":{"content":"Hi"},"finish_reason":null}]}\n',
      },
      { at: 20_000, data: ": keep-alive\n" },
      // 25s after the keep-alive (45s after the first delta — past a non-reset window)
      {
        at: 45_000,
        data: 'data: {"choices":[{"delta":{"content":"!"},"finish_reason":"stop"}]}\ndata: [DONE]\n',
        close: true,
      },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

    const pending = collect(streamChatCompletion(baseRequest()));
    await vi.advanceTimersByTimeAsync(45_000);

    expect(await pending).toEqual([
      { type: "delta", text: "Hi" },
      { type: "delta", text: "!" },
      { type: "done", finishReason: "stop" },
    ]);
  });

  it("yields aborted when the caller aborts mid-stream", async () => {
    vi.useFakeTimers();
    const stream = scriptedStream([
      {
        at: 0,
        data: 'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n',
      },
      // then the stream stays open
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream, { status: 200 })));

    const controller = new AbortController();
    const pending = collect(streamChatCompletion(baseRequest(controller.signal)));
    await vi.advanceTimersByTimeAsync(0);
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(await pending).toEqual([{ type: "delta", text: "partial" }, { type: "aborted" }]);
  });
});
