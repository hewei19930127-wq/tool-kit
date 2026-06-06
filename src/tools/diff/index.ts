import { GitCompare } from "lucide-react";
import type { Tool } from "@/core/types";
import DiffTool from "./DiffTool";

export const diffTool: Tool = {
  id: "diff",
  name: "Diff",
  category: "convert-other",
  icon: GitCompare,
  keywords: ["diff", "compare", "merge", "change", "比较"],
  component: DiffTool,
};
