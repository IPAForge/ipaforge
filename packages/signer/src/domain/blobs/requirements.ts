import { ByteWriter, utf8Encode } from "@loadstar/kernel";
import { CSMAGIC_REQUIREMENT, CSMAGIC_REQUIREMENTS } from "@signer/domain/blobs/constants.ts";

const kSecDesignatedRequirementType = 3;
const kExprForm = 1;

// Requirement opcodes and match types (Security framework requirement language).
const opIdent = 2;
const opAnchorHash = 4;
const opAnd = 6;
const opCertField = 11;
const opCertGeneric = 14;
const opAppleGenericAnchor = 15;
const matchExists = 0;
const matchEqual = 1;
/** Certificate slot index meaning "the anchor (root)". */
const ANCHOR_SLOT = -1;

/** Apple WWDR intermediate marker OID 1.2.840.113635.100.6.2.1 (DER content bytes). */
export const WWDR_MARKER_OID = new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x06, 0x02, 0x01]);

export type DesignatedRequirement =
  /** What codesign writes for Apple Development certificates (production). */
  | { readonly kind: "apple-development"; readonly identifier: string; readonly leafCommonName: string }
  /** `identifier X and certificate root = H"…"` — lets test identities satisfy `codesign --verify`. */
  | { readonly kind: "anchor-hash"; readonly identifier: string; readonly anchorSha1: Uint8Array };

/** `u32 length | bytes | zero padding to 4` */
const writeData = (w: ByteWriter, data: Uint8Array): ByteWriter => w.u32be(data.byteLength).bytes(data).align(4);

const expression = (requirement: DesignatedRequirement): Uint8Array => {
  const w = new ByteWriter();
  // Apple's DRMaker nests Ands to the right: And(ident, And(anchor, And(certField, certGeneric))).
  w.u32be(opAnd).u32be(opIdent);
  writeData(w, utf8Encode(requirement.identifier));
  if (requirement.kind === "anchor-hash") {
    w.u32be(opAnchorHash).u32be(ANCHOR_SLOT >>> 0);
    writeData(w, requirement.anchorSha1);
    return w.toBytes();
  }
  w.u32be(opAnd).u32be(opAppleGenericAnchor);
  w.u32be(opAnd).u32be(opCertField).u32be(0);
  writeData(w, utf8Encode("subject.CN")).u32be(matchEqual);
  writeData(w, utf8Encode(requirement.leafCommonName));
  w.u32be(opCertGeneric).u32be(1);
  writeData(w, WWDR_MARKER_OID).u32be(matchExists);
  return w.toBytes();
};

/** Requirement set with no requirements: what codesign writes for ad-hoc signatures. */
export const emptyRequirementSet = (): Uint8Array =>
  new ByteWriter(12).u32be(CSMAGIC_REQUIREMENTS).u32be(12).u32be(0).toBytes();

/** Requirement set holding one designated requirement. */
export const designatedRequirementSet = (requirement: DesignatedRequirement): Uint8Array => {
  const expr = expression(requirement);
  const requirementBlob = new ByteWriter()
    .u32be(CSMAGIC_REQUIREMENT)
    .u32be(12 + expr.byteLength)
    .u32be(kExprForm)
    .bytes(expr)
    .toBytes();
  const headerSize = 12 + 8;
  return new ByteWriter()
    .u32be(CSMAGIC_REQUIREMENTS)
    .u32be(headerSize + requirementBlob.byteLength)
    .u32be(1)
    .u32be(kSecDesignatedRequirementType)
    .u32be(headerSize)
    .bytes(requirementBlob)
    .toBytes();
};
