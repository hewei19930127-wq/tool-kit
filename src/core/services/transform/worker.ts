/// <reference lib="webworker" />
import type { ToolResult } from "@/core/types";
import { TRANSFORMS, type TransformOpts } from "./transforms";

interface WorkerRequest {
  id: number;
  op: string;
  input: string;
  opts?: TransformOpts;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, op, input, opts } = event.data;
  const fn = TRANSFORMS[op];
  const result: ToolResult = fn
    ? fn(input, opts)
    : { ok: false, error: `Unknown transform: ${op}` };

  (self as DedicatedWorkerGlobalScope).postMessage({ id, result });
};
