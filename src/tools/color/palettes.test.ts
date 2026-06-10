import { describe, expect, it } from "vitest";
import { parseColor } from "./color";
import { palettes } from "./palettes";

describe("palettes", () => {
  it("exposes tailwind and material palettes", () => {
    expect(palettes.map((palette) => palette.id)).toEqual(["tailwind", "material"]);
  });

  it("contains only parseable hex values", () => {
    for (const palette of palettes) {
      for (const group of palette.groups) {
        for (const color of group.colors) {
          expect(parseColor(color.hex).ok, `${palette.id} ${color.name}`).toBe(true);
        }
      }
    }
  });

  it("has unique color names within each palette", () => {
    for (const palette of palettes) {
      const names = palette.groups.flatMap((group) => group.colors.map((color) => color.name));
      expect(new Set(names).size).toBe(names.length);
    }
  });

  it("has consistent group sizes", () => {
    const [tailwind, material] = palettes;
    expect(tailwind.groups).toHaveLength(22);
    expect(material.groups).toHaveLength(19);
    for (const group of tailwind.groups) expect(group.colors).toHaveLength(11);
    for (const group of material.groups) expect(group.colors).toHaveLength(10);
  });
});
