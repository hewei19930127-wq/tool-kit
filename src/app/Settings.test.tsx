import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { makeDefaultTranslateSlice, useAppStore } from "@/core/store";
import { Settings } from "./Settings";

describe("Settings — Translation (AI)", () => {
  beforeEach(() => {
    useAppStore.setState({
      language: "en",
      translate: makeDefaultTranslateSlice(),
    });
  });

  it("edits the API key for the active provider", () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "test-key" },
    });
    expect(useAppStore.getState().translate.providers.deepseek.apiKey).toBe("test-key");
  });

  it("keeps per-provider config when switching providers", () => {
    render(<Settings onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("API key"), {
      target: { value: "deepseek-test-key" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Custom" }));
    fireEvent.change(screen.getByLabelText("Endpoint URL"), {
      target: { value: "http://localhost:11434/v1/chat/completions" },
    });
    fireEvent.click(screen.getByRole("button", { name: "DeepSeek" }));
    const { providers } = useAppStore.getState().translate;
    expect(providers.deepseek.apiKey).toBe("deepseek-test-key");
    expect(providers.custom.endpointUrl).toBe("http://localhost:11434/v1/chat/completions");
  });

  it("masks the key by default and reveals it on toggle", () => {
    render(<Settings onClose={() => {}} />);
    expect(screen.getByLabelText("API key")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show API key" }));
    expect(screen.getByLabelText("API key")).toHaveAttribute("type", "text");
  });

  it("states that keys are stored in plaintext", () => {
    render(<Settings onClose={() => {}} />);
    expect(screen.getByText(/stored locally in ToolKit settings in plaintext/)).toBeInTheDocument();
  });
});
