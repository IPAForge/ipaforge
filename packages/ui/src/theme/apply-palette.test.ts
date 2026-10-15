import { applyPalette, heroUiVariables } from "@ui/theme/apply-palette.ts";
import { palettes } from "@ui/theme/palettes.ts";
import { describe, expect, it } from "vitest";

describe("applyPalette", () => {
  it("sets every HeroUI variable from the tokens", () => {
    const root = document.createElement("html");
    const tokens = palettes.ocean.light;
    applyPalette(root, tokens, "light");

    expect(root.style.getPropertyValue("--accent")).toBe(tokens.accent);
    expect(root.style.getPropertyValue("--surface-secondary")).toBe(tokens.surfaceSecondary);
    for (const [token, variable] of Object.entries(heroUiVariables)) {
      expect(root.style.getPropertyValue(variable)).toBe(tokens[token as keyof typeof tokens]);
    }
  });

  it("marks the scheme with a class and data-theme, replacing the previous one", () => {
    const root = document.createElement("html");
    applyPalette(root, palettes.rose.light, "light");
    applyPalette(root, palettes.rose.dark, "dark");

    expect(root.classList.contains("dark")).toBe(true);
    expect(root.classList.contains("light")).toBe(false);
    expect(root.getAttribute("data-theme")).toBe("dark");
    expect(root.style.getPropertyValue("--background")).toBe(palettes.rose.dark.background);
  });
});
