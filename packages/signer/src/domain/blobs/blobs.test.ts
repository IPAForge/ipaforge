import { createDict, fromHex, isPlistDict, type PlistDict, parseXmlPlist, toHex } from "@loadstar/kernel";
import { type FixtureCase, readFixture } from "@signer/__tests__/fixtures.ts";
import { signedTargets } from "@signer/__tests__/targets.ts";
import {
  blobWrapper,
  buildCodeDirectory,
  buildSuperBlob,
  CS_ADHOC,
  CS_EXECSEG_ALLOW_UNSIGNED,
  CS_EXECSEG_MAIN_BINARY,
  CSSLOT_ALTERNATE_CODEDIRECTORIES,
  CSSLOT_CODEDIRECTORY,
  CSSLOT_DER_ENTITLEMENTS,
  CSSLOT_ENTITLEMENTS,
  CSSLOT_REQUIREMENTS,
  CSSLOT_SIGNATURESLOT,
  designatedRequirementSet,
  emptyRequirementSet,
  entitlementsDerBlob,
  entitlementsXmlBlob,
  findBlob,
  parseCodeDirectory,
  parseSuperBlob,
} from "@signer/domain/blobs/index.ts";
import { findSegment, parseMachO } from "@signer/domain/macho/parse.ts";
import type { Slice } from "@signer/domain/macho/types.ts";
import { createHasher } from "@signer/infrastructure/hashing/index.ts";
import { describe, expect, it } from "vitest";

const hasher = createHasher();

const targets = signedTargets();

const signatureOf = (slice: Slice) => {
  const sig = slice.codeSignature;
  if (!sig) throw new Error("fixture slice is unsigned");
  return {
    blobs: parseSuperBlob(slice.bytes.subarray(sig.dataoff, sig.dataoff + sig.datasize)),
    codeLimit: sig.dataoff,
  };
};

const execSegFlags = (role: FixtureCase["role"], entitlements: PlistDict | undefined): bigint => {
  const executable = role === "main" || role === "appex";
  if (!executable) return 0n;
  return CS_EXECSEG_MAIN_BINARY | (entitlements?.["get-task-allow"] === true ? CS_EXECSEG_ALLOW_UNSIGNED : 0n);
};

describe.each(targets.map((t) => [t.label, t] as const))("signature blobs of %s", (_label, target) => {
  const file = parseMachO(readFixture("expected", ...target.binary));
  const entitlementsBytes = target.entitlements ? readFixture(target.entitlements) : undefined;
  const entitlements = entitlementsBytes ? parseXmlPlist(entitlementsBytes) : undefined;
  if (entitlements !== undefined && !isPlistDict(entitlements)) throw new Error("entitlements must be a dict");

  it.each(file.slices.map((slice, i) => [i, slice] as const))(
    "slice %i: every blob is byte-identical",
    async (_i, slice) => {
      const { blobs, codeLimit } = signatureOf(slice);
      const requirements = emptyRequirementSet();
      const xml = entitlementsBytes && entitlementsXmlBlob(entitlementsBytes);
      const der = entitlements && entitlementsDerBlob(entitlements);

      // slot layout: executables carry entitlements, libraries do not; the CMS wrapper is always present
      const expectedSlots = [CSSLOT_CODEDIRECTORY, CSSLOT_REQUIREMENTS];
      if (xml) expectedSlots.push(CSSLOT_ENTITLEMENTS, CSSLOT_DER_ENTITLEMENTS);
      if (findBlob(blobs, CSSLOT_ALTERNATE_CODEDIRECTORIES)) expectedSlots.push(CSSLOT_ALTERNATE_CODEDIRECTORIES);
      expectedSlots.push(CSSLOT_SIGNATURESLOT);
      expect(blobs.map((b) => b.slot)).toEqual(expectedSlots);

      expect(toHex(findBlob(blobs, CSSLOT_REQUIREMENTS) ?? new Uint8Array())).toBe(toHex(requirements));
      if (xml && der) {
        expect(toHex(findBlob(blobs, CSSLOT_ENTITLEMENTS) ?? new Uint8Array())).toBe(toHex(xml));
        expect(toHex(findBlob(blobs, CSSLOT_DER_ENTITLEMENTS) ?? new Uint8Array())).toBe(toHex(der));
      }
      expect(toHex(findBlob(blobs, CSSLOT_SIGNATURESLOT) ?? new Uint8Array())).toBe(toHex(blobWrapper()));

      const text = findSegment(slice, "__TEXT");
      for (const slot of [CSSLOT_CODEDIRECTORY, CSSLOT_ALTERNATE_CODEDIRECTORIES]) {
        const appleCd = findBlob(blobs, slot);
        if (!appleCd) continue;
        const info = parseCodeDirectory(appleCd);
        expect(info.identifier).toBe(target.identifier);

        const ours = await buildCodeDirectory(
          {
            identifier: target.identifier,
            flags: CS_ADHOC,
            hashType: info.hashType === 1 ? "sha1" : "sha256",
            pageSize: info.pageSize,
            image: slice.bytes,
            codeLimit,
            execSegment: {
              base: text?.fileoff ?? 0n,
              limit: text?.filesize ?? 0n,
              flags: execSegFlags(target.role, entitlements),
            },
            special: {
              ...(target.infoPlist ? { infoPlist: readFixture("expected", ...target.infoPlist) } : {}),
              requirements,
              ...(target.codeResources ? { codeResources: readFixture("expected", ...target.codeResources) } : {}),
              ...(xml && der ? { entitlements: xml, derEntitlements: der } : {}),
            },
          },
          hasher,
        );
        expect(toHex(ours)).toBe(toHex(appleCd));
      }

      // and the whole SuperBlob reassembles identically from its parts
      expect(toHex(buildSuperBlob(blobs))).toBe(
        toHex(slice.bytes.subarray(codeLimit, codeLimit + buildSuperBlob(blobs).length)),
      );
    },
  );
});

describe("designated requirement", () => {
  it("matches the spec's verified Apple Development example (176 bytes)", () => {
    const expected = fromHex(
      "fade0c01000000b0000000010000000300000014" +
        "fade0c000000009c00000001" +
        "00000006 00000002 00000010 636f6d2e6578616d706c652e74657374" +
        "00000006 0000000f 00000006" +
        "0000000b 00000000 0000000a 7375626a6563742e434e0000 00000001 0000002b 4170706c6520446576656c6f706d656e743a205465737420506572736f6e2028414243444531323334352900" +
        "0000000e 00000001 0000000a 2a864886f763640602010000 00000000",
    );
    const ours = designatedRequirementSet({
      kind: "apple-development",
      identifier: "com.example.test",
      leafCommonName: "Apple Development: Test Person (ABCDE12345)",
    });
    expect(ours).toHaveLength(176);
    expect(toHex(ours)).toBe(toHex(expected));
  });

  it("encodes the anchor-hash form used for test identities", () => {
    const set = designatedRequirementSet({
      kind: "anchor-hash",
      identifier: "a.b",
      anchorSha1: new Uint8Array(20).fill(7),
    });
    expect(toHex(set)).toContain(`00000004ffffffff00000014${"07".repeat(20)}`);
  });
});

describe("DER entitlements", () => {
  it("matches the spec's verified vector (nested dict, Unicode, negatives, empty array)", () => {
    const value = createDict([
      [
        "zeta",
        createDict([
          ["b", 128],
          ["a", -1],
        ]),
      ],
      ["Zcap", "é"],
      ["alpha", []],
      ["alpha-", false],
      ["alph", 0],
    ]);
    expect(toHex(entitlementsDerBlob(value)).slice(16)).toBe(
      "704f020101b04a300a0c045a6361700c02c3a930090c04616c706802010030090c05616c7068613000300b0c06616c7068612d010100" +
        "30190c047a657461b01130060c01610201ff30070c0162020200" +
        "80",
    );
  });

  it("rejects values DER cannot represent", () => {
    expect(() => entitlementsDerBlob(createDict([["d", new Uint8Array(1)]]))).toThrow();
  });
});
