import { Hash } from "lucide-react";
import type { Tool } from "@/core/types";
import RadixTool from "./RadixTool";

export const radixTool: Tool = {
  id: "radix",
  name: "Radix / 进制",
  icon: Hash,
  keywords: ["radix", "base", "binary", "hex", "octal", "进制", "bitwise"],
  component: RadixTool,
};
