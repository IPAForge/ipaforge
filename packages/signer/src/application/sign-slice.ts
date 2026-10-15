// Signs one thin Mach-O slice: reserve room, build the CodeDirectories, sign them, embed the SuperBlob.
import { compact, ErrorCode, LoadstarError, type PlistDict, utf8Encode } from "@loadstar/kernel";
import { carriesEntitlements, execSegmentFlags, pageSizeFor } from "@signer/application/policy.ts";
import type { SignatureContent, SigningMode } from "@signer/application/signing.ts";
import type { SigningDeps } from "@signer/deps.ts";
import {
  type BlobEntry,
  blobWrapper,
  buildCodeDirectory,
  buildSuperBlob,
  CS_ADHOC,
  CSSLOT_ALTERNATE_CODEDIRECTORIES,
  CSSLOT_CODEDIRECTORY,
  CSSLOT_DER_ENTITLEMENTS,
  CSSLOT_ENTITLEMENTS,
  CSSLOT_REQUIREMENTS,
  CSSLOT_SIGNATURESLOT,
  cdHash,
  designatedRequirementSet,
  type ExecSegment,
  emptyRequirementSet,
  entitlementsDerBlob,
  entitlementsXmlBlob,
  type SpecialSlotData,
} from "@signer/domain/blobs/index.ts";
import type { SigningPolicy } from "@signer/domain/config.ts";
import { estimateSignatureSize, type PreparedImage, prepareImage } from "@signer/domain/macho/allocate.ts";
import { isEncryptedSlice } from "@signer/domain/macho/encryption.ts";
import { findSegment } from "@signer/domain/macho/parse.ts";
import type { Slice } from "@signer/domain/macho/types.ts";
import { DIGEST_SIZE, type HashAlgorithm } from "@signer/domain/ports/hasher.ts";
import { certificateInfo } from "@signer/infrastructure/cms/certificate.ts";
import { type SignedCodeDirectory, signCodeDirectories } from "@signer/infrastructure/cms/sign.ts";

export interface SignedSlice {
  readonly bytes: Uint8Array;
  /** cdhash (20 bytes) of the slice's primary CodeDirectory. */
  readonly cdhash: Uint8Array;
}

interface EntitlementBlobs {
  readonly dict: PlistDict;
  /** Slot 5: the plist bytes, verbatim. */
  readonly xml: Uint8Array;
  /** Slot 7: the DER encoding. */
  readonly der: Uint8Array;
}

/** Everything decided about a slice's signature before any bytes are hashed. */
interface SlicePlan {
  readonly identifier: string;
  readonly teamId: string | undefined;
  readonly flags: number;
  readonly algorithms: readonly HashAlgorithm[];
  readonly pageSize: number;
  readonly requirements: Uint8Array;
  readonly entitlements: EntitlementBlobs | undefined;
  readonly special: SpecialSlotData;
}

const NSPECIAL = { infoPlist: 1, requirements: 2, codeResources: 3, entitlements: 5, derEntitlements: 7 } as const;

const highestSpecialSlot = (special: SpecialSlotData): number =>
  Math.max(0, ...Object.entries(NSPECIAL).map(([key, slot]) => (special[key as keyof SpecialSlotData] ? slot : 0)));

const assertDecrypted = (slice: Slice, identifier: string): void => {
  if (!isEncryptedSlice(slice)) return;
  throw new LoadstarError(ErrorCode.EncryptedBinary, {
    message: "binary is FairPlay-encrypted (App Store build); a decrypted IPA is required",
    data: { identifier },
  });
};

const requirementsFor = (content: SignatureContent): Uint8Array => {
  if (content.signing.kind === "adhoc") return emptyRequirementSet();
  const custom = content.signing.requirement?.(content.identifier);
  if (custom) return designatedRequirementSet(custom);
  const leafCommonName = certificateInfo(content.signing.identity.certificate).commonName ?? "";
  return designatedRequirementSet({ kind: "apple-development", identifier: content.identifier, leafCommonName });
};

/** The team written into the CodeDirectory; an empty team ID means none. */
const teamIdOf = (signing: SigningMode): string | undefined =>
  signing.kind === "identity" ? signing.teamId || undefined : undefined;

/** Entitlement blobs, for executables only (codesign `mainBinary` rule). */
const entitlementBlobsFor = (slice: Slice, content: SignatureContent): EntitlementBlobs | undefined => {
  const entitlements = carriesEntitlements(slice) ? content.entitlements : undefined;
  if (!entitlements) return undefined;
  return {
    dict: entitlements.dict,
    xml: entitlementsXmlBlob(entitlements.bytes),
    der: entitlementsDerBlob(entitlements.dict),
  };
};

const planSlice = (
  slice: Slice,
  content: SignatureContent,
  algorithms: readonly HashAlgorithm[],
  policy: SigningPolicy,
): SlicePlan => {
  const requirements = requirementsFor(content);
  const entitlements = entitlementBlobsFor(slice, content);
  return {
    identifier: content.identifier,
    teamId: teamIdOf(content.signing),
    flags: content.signing.kind === "adhoc" ? CS_ADHOC : 0,
    algorithms,
    pageSize: pageSizeFor(slice, policy.pageSize),
    requirements,
    entitlements,
    special: compact({
      infoPlist: content.infoPlist,
      requirements,
      codeResources: content.codeResources,
      entitlements: entitlements?.xml,
      derEntitlements: entitlements?.der,
    }),
  };
};

/** The non-CodeDirectory blobs the SuperBlob carries besides the CMS wrapper. */
const signaturePieces = (plan: SlicePlan): Uint8Array[] =>
  plan.entitlements ? [plan.requirements, plan.entitlements.xml, plan.entitlements.der] : [plan.requirements];

/** Sizes the signature exactly as codesign does and makes room for it in the slice. */
const reserveSignature = (slice: Slice, plan: SlicePlan, cmsReservation: number): PreparedImage => {
  const datasize = estimateSignatureSize(slice, {
    pieces: signaturePieces(plan),
    codeDirectories: plan.algorithms.map((algorithm) => ({
      identifierLength: utf8Encode(plan.identifier).byteLength,
      teamIdLength: plan.teamId ? utf8Encode(plan.teamId).byteLength : 0,
      pageSize: plan.pageSize,
      hashSize: DIGEST_SIZE[algorithm],
      nSpecialSlots: highestSpecialSlot(plan.special),
    })),
    cmsReservation,
  });
  return prepareImage(slice, datasize);
};

/** The __TEXT exec segment, present only when the slice has a platform load command. */
const execSegmentOf = (slice: Slice, entitlements: PlistDict | undefined): ExecSegment | undefined => {
  if (!slice.buildVersion) return undefined;
  const text = findSegment(slice, "__TEXT");
  return { base: text?.fileoff ?? 0n, limit: text?.filesize ?? 0n, flags: execSegmentFlags(slice, entitlements) };
};

/** One CodeDirectory per hash algorithm, primary first. */
const buildCodeDirectories = (
  slice: Slice,
  plan: SlicePlan,
  prepared: PreparedImage,
  deps: SigningDeps,
): Promise<SignedCodeDirectory[]> => {
  const execSegment = execSegmentOf(slice, plan.entitlements?.dict);
  return Promise.all(
    plan.algorithms.map(async (algorithm) => ({
      algorithm,
      bytes: await buildCodeDirectory(
        compact({
          identifier: plan.identifier,
          teamId: plan.teamId,
          flags: plan.flags,
          hashType: algorithm,
          pageSize: plan.pageSize,
          image: prepared.image,
          codeLimit: prepared.codeLimit,
          execSegment,
          special: plan.special,
        }),
        deps.hasher,
      ),
    })),
  );
};

/** The CMS signature over the CodeDirectories (empty for ad-hoc signing). */
const cmsSignature = async (
  codeDirectories: readonly SignedCodeDirectory[],
  signing: SigningMode,
  deps: SigningDeps,
): Promise<Uint8Array> =>
  signing.kind === "identity"
    ? signCodeDirectories(codeDirectories, signing.identity, deps.clock.now(), deps.hasher)
    : new Uint8Array(0);

const codeDirectorySlot = (index: number): number =>
  index === 0 ? CSSLOT_CODEDIRECTORY : CSSLOT_ALTERNATE_CODEDIRECTORIES + index - 1;

const signatureEntries = (
  plan: SlicePlan,
  cms: Uint8Array,
  codeDirectories: readonly SignedCodeDirectory[],
): BlobEntry[] => [
  { slot: CSSLOT_REQUIREMENTS, blob: plan.requirements },
  { slot: CSSLOT_SIGNATURESLOT, blob: blobWrapper(cms) },
  ...codeDirectories.map((cd, i) => ({ slot: codeDirectorySlot(i), blob: cd.bytes })),
  ...(plan.entitlements
    ? [
        { slot: CSSLOT_ENTITLEMENTS, blob: plan.entitlements.xml },
        { slot: CSSLOT_DER_ENTITLEMENTS, blob: plan.entitlements.der },
      ]
    : []),
];

/** Writes the SuperBlob into the space reserved for it. */
const embedSignature = (prepared: PreparedImage, superBlob: Uint8Array): void => {
  if (superBlob.byteLength > prepared.datasize) {
    throw new LoadstarError(ErrorCode.Unexpected, {
      message: "signature larger than its reservation",
      data: { signature: superBlob.byteLength, reserved: prepared.datasize },
    });
  }
  prepared.image.set(superBlob, prepared.codeLimit);
};

/** Signs one slice with every algorithm in `algorithms` (the first is the primary CodeDirectory). */
export const signSlice = async (
  slice: Slice,
  content: SignatureContent,
  settings: { readonly algorithms: readonly HashAlgorithm[]; readonly policy: SigningPolicy },
  deps: SigningDeps,
): Promise<SignedSlice> => {
  assertDecrypted(slice, content.identifier);
  const plan = planSlice(slice, content, settings.algorithms, settings.policy);
  const prepared = reserveSignature(slice, plan, settings.policy.cmsReservation);
  const codeDirectories = await buildCodeDirectories(slice, plan, prepared, deps);
  const cms = await cmsSignature(codeDirectories, content.signing, deps);
  const superBlob = buildSuperBlob(signatureEntries(plan, cms, codeDirectories));
  embedSignature(prepared, superBlob);

  const primary = codeDirectories[0] as SignedCodeDirectory;
  deps.logger.debug("signed slice", {
    identifier: content.identifier,
    cputype: slice.cputype,
    pageSize: plan.pageSize,
    algorithms: settings.algorithms,
    codeLimit: prepared.codeLimit,
    signatureBytes: superBlob.byteLength,
    addedLoadCommand: prepared.addedLoadCommand,
  });
  return { bytes: prepared.image, cdhash: await cdHash(primary.bytes, primary.algorithm, deps.hasher) };
};
