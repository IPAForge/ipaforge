import { heroUiVariables } from "@ui/theme/apply-palette.ts";
import { palettes } from "@ui/theme/palettes.ts";
import { colorSchemes, paletteIds } from "@ui/theme/theme-types.ts";
import { describe, expect, it } from "vitest";

const OKLCH = /^oklch\(\d*\.?\d+ \d*\.?\d+ \d+\)$/;
const tokenNames = Object.keys(heroUiVariables).sort();

describe("palettes", () => {
  it("defines exactly the six palettes", () => {
    expect(Object.keys(palettes).sort()).toEqual([...paletteIds].sort());
  });

  describe.each(paletteIds)("%s", (id) => {
    it.each(colorSchemes)("has every token as oklch in %s", (scheme) => {
      const tokens = palettes[id][scheme];
      expect(Object.keys(tokens).sort()).toEqual(tokenNames);
      for (const value of Object.values(tokens)) expect(value).toMatch(OKLCH);
    });

    it("differs between light and dark", () => {
      expect(palettes[id].light.background).not.toBe(palettes[id].dark.background);
    });
  });
});
