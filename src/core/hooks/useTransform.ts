import { useCallback, useState } from "react";
import { runInWorker } from "@/core/services/transform/pool";
import { chooseRoute, type RouteDeps, runTransform } from "@/core/services/transform/route";
import { runRust } from "@/core/services/transform/rust";
import type { TransformOpts } from "@/core/services/transform/transforms";
import type { ToolResult } from "@/core/types";

const browserDeps: RouteDeps = {
  chooseRoute: (length) => chooseRoute(length),
  worker: runInWorker,
  rust: runRust,
};

export function useTransform() {
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (op: string, input: string, opts?: TransformOpts): Promise<ToolResult> => {
      setPending(true);
      try {
        return await runTransform(op, input, opts, browserDeps);
      } finally {
        setPending(false);
      }
    },
    [],
  );

  return { run, pending };
}
