import { useCallback } from "react";
import { useAppStore } from "@/core/store";

export function useToolInput(toolId: string): [string, (text: string) => void] {
  const value = useAppStore((state) => state.toolInputs[toolId] ?? "");
  const setToolInput = useAppStore((state) => state.setToolInput);
  const set = useCallback((text: string) => setToolInput(toolId, text), [toolId, setToolInput]);
  return [value, set];
}
