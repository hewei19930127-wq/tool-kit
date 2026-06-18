import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type KV, setStorageBackend } from "@/core/services/storage";
import { makeDefaultTranslateSlice, useAppStore } from "@/core/store";
import type { StreamEvent, StreamRequest } from "./client";
import TranslateTool from "./TranslateTool";

vi.mock("./client", () => ({ streamChatCompletion: vi.fn() }));

import { streamChatCompletion } from "./client";

const mockStream = vi.mocked(streamChatCompletion);

function events(...list: StreamEvent[]): AsyncGenerator<StreamEvent> {
  return (async function* () {
    for (const event of list) yield event;
  })();
}

function memoryBackend(): KV {
  const map = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      return map.has(key) ? (map.get(key) as T) : null;
    },
    async set<T>(key: string, value: T) {
      map.set(key, value);
    },
  };
}

function sliceWithKey() {
  const slice = makeDefaultTranslateSlice();
  slice.providers.deepseek.apiKey = "test-key";
  return slice;
}

function typeAndTranslate(text: string) {
  fireEvent.change(screen.getByLabelText("Translate input"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: /Translate/ }));
}

describe("TranslateTool", () => {
  beforeEach(() => {
    setStorageBackend(memoryBackend());
    useAppStore.setState({
      language: "en",
      toolInputs: {},
      translate: sliceWithKey(),
    });
    mockStream.mockReset();
  });

  it("streams a translation into the output pane", async () => {
    mockStream.mockReturnValue(
      events(
        { type: "delta", text: "Hel" },
        { type: "delta", text: "lo" },
        { type: "done", finishReason: "stop" },
      ),
    );
    render(<TranslateTool />);
    typeAndTranslate("你好");
    await screen.findByText("Hello");
    expect(screen.getByText("done")).toBeInTheDocument();
    expect(screen.getByText("deepseek-v4-flash")).toBeInTheDocument();
  });

  it("Stop leaves partial output marked stopped", async () => {
    mockStream.mockImplementation((request: StreamRequest) =>
      (async function* () {
        yield { type: "delta", text: "partial" } as StreamEvent;
        await new Promise<void>((resolve) => {
          if (request.signal.aborted) resolve();
          else
            request.signal.addEventListener("abort", () => resolve(), {
              once: true,
            });
        });
        yield { type: "aborted" } as StreamEvent;
      })(),
    );
    render(<TranslateTool />);
    typeAndTranslate("你好");
    await screen.findByText("partial");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    await screen.findByText("stopped");
    expect(screen.getByText("partial")).toBeInTheDocument();
  });

  it("clear resets input and output", async () => {
    mockStream.mockReturnValue(
      events({ type: "delta", text: "Hi" }, { type: "done", finishReason: "stop" }),
    );
    render(<TranslateTool />);
    typeAndTranslate("你好");
    await screen.findByText("Hi");
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByLabelText("Translate input")).toHaveValue("");
    expect(screen.queryByText("Hi")).not.toBeInTheDocument();
  });

  it("gates long input behind a confirmation", async () => {
    mockStream.mockReturnValue(events({ type: "done", finishReason: "stop" }));
    render(<TranslateTool />);
    typeAndTranslate("x".repeat(20_001));
    expect(mockStream).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(mockStream).toHaveBeenCalledTimes(1));
  });

  it("shows a truncation warning on finish_reason length", async () => {
    mockStream.mockReturnValue(
      events({ type: "delta", text: "partial" }, { type: "done", finishReason: "length" }),
    );
    render(<TranslateTool />);
    typeAndTranslate("你好");
    await screen.findByText(/cut the output short/);
    expect(screen.getByText("partial")).toBeInTheDocument();
  });

  it("shows a setup hint instead of sending without an API key", () => {
    useAppStore.setState({ translate: makeDefaultTranslateSlice() });
    render(<TranslateTool />);
    typeAndTranslate("你好");
    expect(mockStream).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/No API key/);
  });

  it("renders an inline error banner on provider failure", async () => {
    mockStream.mockReturnValue(
      events({
        type: "error",
        errorKey: "tools.translate.errors.unauthorized",
        params: { status: 401 },
        detail: "Invalid API key provided",
      }),
    );
    render(<TranslateTool />);
    typeAndTranslate("你好");
    await screen.findByRole("alert");
    expect(screen.getByRole("alert")).toHaveTextContent(/Invalid API key/);
  });
});
