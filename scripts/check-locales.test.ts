import { join } from "node:path";
import { parse } from "@formatjs/icu-messageformat-parser";
import { describe, expect, it } from "vitest";
import { argumentsOf, checkLocales, flatten, formatCompletion } from "./check-locales.ts";

const fixtures = join(import.meta.dirname, "__fixtures__", "locales");
const uiLocales = join(import.meta.dirname, "..", "packages", "ui", "src", "locales");

describe("checkLocales", () => {
  it("passes complete locales and counts an empty message as untranslated", () => {
    const report = checkLocales(join(fixtures, "clean"));
    expect(report.issues).toEqual([]);
    expect(report.completion).toEqual([
      { language: "en", status: "source", translated: 3, total: 3 },
      { language: "ru", status: "draft", translated: 2, total: 3 },
    ]);
    expect(report.completion.map(formatCompletion)).toEqual([
      "[locales] en     100 %  3/3  source",
      "[locales] ru      66 %  2/3  draft",
    ]);
  });

  it("reports every problem with language and key", () => {
    const { issues } = checkLocales(join(fixtures, "dirty"));
    expect(issues.map((issue) => `${issue.language} ${issue.key ?? "-"} ${issue.problem}`)).toEqual([
      "de - status",
      "fr - missing-file",
      "it - unlisted-file",
      "en - status",
      "de nav.logs missing-key",
      "de nav.extra extra-key",
      "de devices invalid-icu",
      "de greeting placeholder-mismatch",
      "de broken not-a-string",
      "en broken invalid-icu",
    ]);
  });

  it("passes the UI's own locale files", () => {
    expect(checkLocales(uiLocales).issues).toEqual([]);
  });
});

describe("flatten", () => {
  it("turns nested messages into dotted keys", () => {
    expect([...flatten({ a: { b: "x", c: { d: "y" } }, e: 1 })]).toEqual([
      ["a.b", "x"],
      ["a.c.d", "y"],
      ["e", 1],
    ]);
  });
});

describe("argumentsOf", () => {
  it("lists arguments with their types, including those nested in plural branches", () => {
    const message = "{count, plural, one {# app by {author}} other {# apps}} on {when, date}";
    expect(argumentsOf(parse(message))).toEqual(["author:argument", "count:plural", "when:date"]);
  });
});
