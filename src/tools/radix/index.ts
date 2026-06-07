import { Hash } from "lucide-react";
import type { Tool } from "@/core/types";
import RadixTool from "./RadixTool";

export const radixTool: Tool = {
  id: "radix",
  nameKey: "tools.radix.name",
  icon: Hash,
  keywordsKey: "tools.radix.keywords",
  component: RadixTool,
};
