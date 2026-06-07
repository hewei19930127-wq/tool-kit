import { GitCompare } from "lucide-react";
import type { Tool } from "@/core/types";
import DiffTool from "./DiffTool";

export const diffTool: Tool = {
  id: "diff",
  nameKey: "tools.diff.name",
  icon: GitCompare,
  keywordsKey: "tools.diff.keywords",
  component: DiffTool,
};
