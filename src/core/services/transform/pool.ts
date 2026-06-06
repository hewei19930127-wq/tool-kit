import type { ToolResult } from "@/core/types";
import type { TransformOpts } from "./transforms";

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (result: ToolResult) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (
      event: MessageEvent<{ id: number; result: ToolResult }>,
    ) => {
      const { id, result } = event.data;
      pending.get(id)?.(result);
      pending.delete(id);
    };
    worker.onerror = (event) => {
      const result: ToolResult = {
        ok: false,
        error: event.message || "Worker transform failed",
      };
      for (const resolve of pending.values()) resolve(result);
      pending.clear();
      worker?.terminate();
      worker = null;
    };
  }

  return worker;
}

export function runInWorker(
  op: string,
  input: string,
  opts?: TransformOpts,
): Promise<ToolResult> {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    getWorker().postMessage({ id, op, input, opts });
  });
}
