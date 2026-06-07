import type { ToolResult } from "@/core/types";
import { TRANSFORMS, type TransformOpts } from "./transforms";

export type Route = "main" | "worker" | "rust";

export interface RouteThresholds {
  workerAt: number;
  rustAt: number;
}

export const DEFAULT_THRESHOLDS: RouteThresholds = {
  workerAt: 50_000,
  rustAt: 1_000_000,
};

export const RUST_OPS = new Set(["json.format", "json.minify", "xml.format", "xml.minify"]);

export function chooseRoute(
  length: number,
  thresholds: RouteThresholds = DEFAULT_THRESHOLDS,
): Route {
  if (length >= thresholds.rustAt) return "rust";
  if (length >= thresholds.workerAt) return "worker";
  return "main";
}

export interface RouteDeps {
  chooseRoute: (length: number) => Route;
  worker: (op: string, input: string, opts?: TransformOpts) => Promise<ToolResult>;
  rust: (op: string, input: string, opts?: TransformOpts) => Promise<ToolResult>;
}

export async function runTransform(
  op: string,
  input: string,
  opts: TransformOpts | undefined,
  deps: RouteDeps,
): Promise<ToolResult> {
  const fn = TRANSFORMS[op];
  if (!fn) {
    return {
      ok: false,
      error: `Unknown transform: ${op}`,
      errorKey: "core.transform.errors.unknown",
      params: { operation: op },
    };
  }

  const route = deps.chooseRoute(input.length);
  if (route === "rust" && RUST_OPS.has(op)) {
    const result = await deps.rust(op, input, opts);
    if (result.ok) return result;
    return deps.worker(op, input, opts);
  }
  if (route !== "main") return deps.worker(op, input, opts);
  return fn(input, opts);
}
