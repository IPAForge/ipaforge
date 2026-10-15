import { matchLocale } from "@ui/utils/i18n/match-locale.ts";
import { describe, expect, it } from "vitest";

const SHIPPED = ["en", "de", "ro", "ru", "ar", "ja"] as const;
const WITH_REGIONS = ["en", "pt", "pt-BR", "zh-Hant", "ar"] as const;

describe("matchLocale", () => {
  it.each([
    { preferred: ["de-DE"], expected: "de" },
    { preferred: ["ar-EG"], expected: "ar" },
    { preferred: ["ja"], expected: "ja" },
    { preferred: ["pt-BR"], expected: "en" },
    { preferred: ["zh-Hant-HK"], expected: "en" },
    { preferred: ["tlh"], expected: "en" },
    { preferred: [], expected: "en" },
    { preferred: ["not a tag", "ro-MD"], expected: "ro" },
    { preferred: ["fr-FR", "ru-RU", "de"], expected: "ru" },
  ])("$preferred → $expected among the shipped languages", ({ preferred, expected }) => {
    expect(matchLocale(preferred, SHIPPED, "en")).toBe(expected);
  });

  it.each([
    { preferred: ["pt-BR"], expected: "pt-BR" },
    { preferred: ["pt-br"], expected: "pt-BR" },
    { preferred: ["pt-PT"], expected: "pt" },
    { preferred: ["zh-Hant-HK"], expected: "zh-Hant" },
    { preferred: ["ar-EG"], expected: "ar" },
    { preferred: ["xx-YY"], expected: "en" },
  ])("$preferred → $expected: exact first, then fewer subtags", ({ preferred, expected }) => {
    expect(matchLocale(preferred, WITH_REGIONS, "en")).toBe(expected);
  });
});
