import { join } from "node:path";
import { type PlistDict, parseXmlPlist, utf8Decode } from "@loadstar/kernel";
import { FIXTURES_DIR, readFixture, readTree } from "@signer/__tests__/fixtures.ts";
import { buildCodeResources, type ResourceEntry } from "@signer/domain/code-resources/index.ts";
import { createHasher } from "@signer/infrastructure/hashing/index.ts";
import { describe, expect, it } from "vitest";

const hasher = createHasher();

const entriesOf = (bundle: string): ResourceEntry[] =>
  readTree(join(FIXTURES_DIR, "expected", bundle)).map((e) =>
    e.kind === "symlink"
      ? { path: e.path, kind: "symlink", target: e.target ?? "" }
      : { path: e.path, kind: "file", data: e.data ?? new Uint8Array() },
  );

const bundles = [
  ["Test.app", "Test"],
  ["Test.app/Frameworks/Lib.framework", "Lib"],
  ["Test.app/PlugIns/Ext.appex", "Ext"],
] as const;

describe.each(bundles)("CodeResources of %s", (bundle, executable) => {
  it("is byte-identical to Apple codesign", async () => {
    const result = await buildCodeResources(
      entriesOf(bundle),
      { mainExecutable: executable, hashMode: "sha256" },
      hasher,
    );
    const apple = readFixture("expected", ...bundle.split("/"), "_CodeSignature", "CodeResources");
    expect(utf8Decode(result.bytes)).toBe(utf8Decode(apple));
  });
});

describe("sealing rules", () => {
  it("applies omit/optional/symlink/exclusion rules on the app bundle", async () => {
    const result = await buildCodeResources(
      entriesOf("Test.app"),
      { mainExecutable: "Test", hashMode: "sha256" },
      hasher,
    );
    const plist = parseXmlPlist(result.bytes) as PlistDict;
    const files = plist.files as PlistDict;
    const files2 = plist.files2 as PlistDict;

    // .DS_Store, Info.plist, PkgInfo: in v1 files, omitted from files2
    for (const path of [".DS_Store", "Info.plist", "PkgInfo"]) {
      expect(files[path]).toBeDefined();
      expect(files2[path]).toBeUndefined();
    }
    // lproj content is optional; symlinks only appear in files2
    expect((files2["en.lproj/Localizable.strings"] as PlistDict).optional).toBe(true);
    expect(files2["Strings-link"]).toEqual(expect.objectContaining({ symlink: "en.lproj/Localizable.strings" }));
    expect(files["Strings-link"]).toBeUndefined();
    // nested code is sealed as plain files, including its own CodeResources
    expect(files2["Frameworks/Lib.framework/_CodeSignature/CodeResources"]).toBeDefined();
    expect(files2["PlugIns/Ext.appex/Ext"]).toBeDefined();
    // root exclusions: main executable and our own signature directory
    expect(files2.Test).toBeUndefined();
    expect(Object.keys(files2).some((p) => p.startsWith("_CodeSignature/"))).toBe(false);
    expect(result.omitted).toBe(3);
  });

  it("adds SHA-1 `hash` to files2 in dual (SHA-1 + SHA-256) mode", async () => {
    const entries: ResourceEntry[] = [{ path: "a.txt", kind: "file", data: new TextEncoder().encode("a") }];
    const result = await buildCodeResources(entries, { mainExecutable: "X", hashMode: "dual" }, hasher);
    const entry = ((parseXmlPlist(result.bytes) as PlistDict).files2 as PlistDict)["a.txt"] as PlistDict;
    expect(Object.keys(entry)).toEqual(["hash", "hash2"]);
  });

  it("escapes regex characters in the main executable name", async () => {
    const entries: ResourceEntry[] = [
      { path: "My App+", kind: "file", data: new Uint8Array(1) },
      { path: "My Appp", kind: "file", data: new Uint8Array(1) },
    ];
    const result = await buildCodeResources(entries, { mainExecutable: "My App+", hashMode: "sha256" }, hasher);
    const files2 = (parseXmlPlist(result.bytes) as PlistDict).files2 as PlistDict;
    expect(Object.keys(files2)).toEqual(["My Appp"]);
  });
});
