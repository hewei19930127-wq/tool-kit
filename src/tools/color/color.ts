import { colord, extend } from "colord";
import a11yPlugin from "colord/plugins/a11y";
import type { ToolResult } from "@/core/types";

extend([a11yPlugin]);

export interface ColorModels {
  hex: string;
  rgb: string;
  hsl: string;
  hsv: string;
}

export function parseColor(input: string): ToolResult<ColorModels> {
  const color = colord(input.trim());
  if (!color.isValid()) return { ok: false, error: "Unrecognized color" };

  const hsv = color.toHsv();

  return {
    ok: true,
    value: {
      hex: color.toHex(),
      rgb: color.toRgbString(),
      hsl: color.toHslString(),
      hsv: `hsv(${Math.round(hsv.h)}, ${Math.round(hsv.s)}%, ${Math.round(hsv.v)}%)`,
    },
  };
}

export function contrastRatio(fg: string, bg: string): ToolResult<number> {
  const foreground = colord(fg.trim());
  const background = colord(bg.trim());

  if (!foreground.isValid() || !background.isValid()) {
    return { ok: false, error: "Both colors must be valid" };
  }

  return { ok: true, value: foreground.contrast(background) };
}

export interface WcagLevels {
  aaLarge: boolean;
  aa: boolean;
  aaa: boolean;
}

export function wcagLevels(ratio: number): WcagLevels {
  return { aaLarge: ratio >= 3, aa: ratio >= 4.5, aaa: ratio >= 7 };
}
