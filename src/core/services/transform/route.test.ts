import { describe, expect, it, vi } from "vitest";
import { chooseRoute, runTransform, type RouteDeps } from "./route";

describe("chooseRoute", () => {
  const opts = { workerAt: 50_000, rustAt: 1_000_000 };

  it("stays on the main thread for small inputs", () => {
    expect(chooseRoute(100, opts)).toBe("main");
  });

  it("uses the worker at the worker threshold", () => {
    expect(chooseRoute(50_000, opts)).toBe("worker");
  });

  it("uses rust at the rust threshold", () => {
    expect(chooseRoute(1_000_000, opts)).toBe("rust");
  });
});

describe("runTransform", () => {
  const baseDeps = (route: "main" | "worker" | "rust"): RouteDeps => ({
    chooseRoute: () => route,
    worker: vi.fn(async () => ({ ok: true, value: "worker" }) as const),
    rust: vi.fn(async () => ({ ok: true, value: "rust" }) as const),
  });

  it("runs small inputs synchronously from the registry", async () => {
    const deps = baseDeps("main");
    const result = await runTransform(
      "json.minify",
      '{"a": 1}',
      undefined,
      deps,
    );
    expect(result).toEqual({ ok: true, value: '{"a":1}' });
    expect(deps.worker).not.toHaveBeenCalled();
  });

  it("offloads to the worker when routed there", async () => {
    const deps = baseDeps("worker");
    const result = await runTransform(
      "json.format",
      "x".repeat(60_000),
      undefined,
      deps,
    );
    expect(result).toEqual({ ok: true, value: "worker" });
  });

  it("uses rust when routed and a rust path exists", async () => {
    const deps = baseDeps("rust");
    const result = await runTransform(
      "json.format",
      "x".repeat(2_000_000),
      undefined,
      deps,
    );
    expect(result).toEqual({ ok: true, value: "rust" });
  });

  it("falls back to the worker when the rust path fails", async () => {
    const deps: RouteDeps = {
      chooseRoute: () => "rust",
      worker: vi.fn(async () => ({ ok: true, value: "worker" }) as const),
      rust: vi.fn(async () => ({ ok: false, error: "rust failed" }) as const),
    };
    const result = await runTransform(
      "json.format",
      "x".repeat(2_000_000),
      undefined,
      deps,
    );
    expect(result).toEqual({ ok: true, value: "worker" });
  });

  it("falls back to the worker when routed to rust but no rust path exists", async () => {
    const deps = baseDeps("rust");
    const result = await runTransform(
      "json.sortKeys",
      "x".repeat(2_000_000),
      undefined,
      deps,
    );
    expect(result).toEqual({ ok: true, value: "worker" });
    expect(deps.rust).not.toHaveBeenCalled();
  });

  it("errors for an unknown op", async () => {
    const result = await runTransform(
      "nope.op",
      "x",
      undefined,
      baseDeps("main"),
    );
    expect(result.ok).toBe(false);
  });
});
