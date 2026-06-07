import { invoke } from "@tauri-apps/api/core";
import type { ToolResult } from "@/core/types";
import type { TransformOpts } from "./transforms";

const RUST_CMD: Record<string, string> = {
  "json.format": "json_format",
  "json.minify": "json_minify",
  "xml.format": "xml_format",
  "xml.minify": "xml_minify",
};

export async function runRust(
  op: string,
  input: string,
  opts?: TransformOpts,
): Promise<ToolResult> {
  const cmd = RUST_CMD[op];
  if (!cmd) {
    return {
      ok: false,
      error: `No Rust fast-path for ${op}`,
      errorKey: "core.transform.errors.noRustFastPath",
      params: { operation: op },
    };
  }

  try {
    const value = await invoke<string>(cmd, {
      input,
      indent: opts?.indent ?? 2,
    });
    return { ok: true, value };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
