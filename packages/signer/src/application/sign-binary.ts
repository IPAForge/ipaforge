import type { PlistDict } from "@loadstar/kernel";
import { ErrorCode, LoadstarError, type Logger, utf8Encode } from "@loadstar/kernel";
import { carriesEntitlements, execSegmentFlags, hashAlgorithmsFor, pageSizeFor } from "@signer/application/policy.ts";
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
  type DesignatedRequirement,
  designatedRequirementSet,
  emptyRequirementSet,
  entitlementsDerBlob,
  entitlementsXmlBlob,
  type SpecialSlotData,
} from "@signer/domain/blobs/index.ts";
import {
  type Overrides,
  resolveLimits,
  resolvePolicy,
  type SignerLimits,
  type SigningPolicy,
} from "@signer/domain/config.ts";
import { estimateSignatureSize, prepareImage } from "@signer/domain/macho/allocate.ts";
import { assembleFat } from "@signer/domain/macho/fat.ts";
import { findSegment, parseMachO } from "@signer/domain/macho/parse.ts";
import type { Slice } from "@signer/domain/macho/types.ts";
import { DIGEST_SIZE, type HashAlgorithm, type Hasher } from "@signer/domain/ports/hasher.ts";
import { certificateInfo } from "@signer/infrastructure/cms/certificate.ts";
import { type SigningIdentity, signCodeDirectories } from "@signer/infrastructure/cms/sign.ts";

/** How a binary is signed: ad-hoc (no identity) or with a certificate. */
export type SigningMode =
  | { readonly kind: "adhoc" }
  | {
      readonly kind: "identity";
      readonly identity: SigningIdentity;
      /** Team ID written into every CodeDirectory (the certificate's OU for Apple certificates). */
      readonly teamId: string;
      /** Designated requirement override; defaults to Apple's Development-certificate form. */
      readonly requirement?: (identifier: string) => DesignatedRequirement;
    };

export interface EntitlementsInput {
  /** Exact plist bytes embedded in slot 5 (codesign embeds the file verbatim). */
  readonly bytes: Uint8Array;
  readonly dict: PlistDict;
}

export interface SignBinaryOptions {
  readonly identifier: string;
  readonly signing: SigningMode;
  readonly entitlements?: EntitlementsInput;
  /** Bundle executables only: Info.plist bytes (slot −1) and CodeResources bytes (slot −3). */
  readonly infoPlist?: Uint8Array;
  readonly codeResources?: Uint8Array;
  /** Page size, hash algorithms and CMS reservation (defaults follow Apple codesign 26). */
  readonly policy?: Partial<SigningPolicy>;
  /** Parser limits for hostile-input protection (defaults: DEFAULT_SIGNER_LIMITS). */
  readonly limits?: Overrides<SignerLimits>;
  readonly signal?: AbortSignal;
}

export interface SignBinaryDeps {
  readonly hasher: Hasher;
  readonly logger: Logger;
  readonly clock: { now(): Date };
}

export interface SignedBinary {
  readonly bytes: Uint8Array;
  /** cdhash (20 bytes) of each slice's primary CodeDirectory. */
  readonly cdhashes: readonly Uint8Array[];
}

const NSPECIAL = { infoPlist: 1, requirements: 2, codeResources: 3, entitlements: 5, derEntitlements: 7 } as const;

const highestSpecialSlot = (special: SpecialSlotData): number =>
  Math.max(0, ...Object.entries(NSPECIAL).map(([key, slot]) => (special[key as keyof SpecialSlotData] ? slot : 0)));

const requirementsFor = (options: SignBinaryOptions): Uint8Array => {
  if (options.signing.kind === "adhoc") return emptyRequirementSet();
  const custom = options.signing.requirement?.(options.identifier);
  if (custom) return designatedRequirementSet(custom);
  const leafCommonName = certificateInfo(options.signing.identity.certificate).commonName ?? "";
  return designatedRequirementSet({ kind: "apple-development", identifier: options.identifier, leafCommonName });
};

const signSlice = async (
  slice: Slice,
  algorithms: readonly HashAlgorithm[],
  options: SignBinaryOptions,
  deps: SignBinaryDeps,
): Promise<{ bytes: Uint8Array; cdhash: Uint8Array }> => {
  if (slice.cryptid !== 0) {
    throw new LoadstarError(ErrorCode.EncryptedBinary, {
      message: "binary is FairPlay-encrypted (App Store build); a decrypted IPA is required",
      data: { identifier: options.identifier },
    });
  }

  const entitlements = carriesEntitlements(slice) ? options.entitlements : undefined;
  const requirements = requirementsFor(options);
  const xml = entitlements && entitlementsXmlBlob(entitlements.bytes);
  const der = entitlements && entitlementsDerBlob(entitlements.dict);
  const special: SpecialSlotData = {
    ...(options.infoPlist ? { infoPlist: options.infoPlist } : {}),
    requirements,
    ...(options.codeResources ? { codeResources: options.codeResources } : {}),
    ...(xml && der ? { entitlements: xml, derEntitlements: der } : {}),
  };
  const teamId = options.signing.kind === "identity" ? options.signing.teamId : undefined;
  const policy = resolvePolicy(options.policy);
  const pageSize = pageSizeFor(slice, policy.pageSize);

  const datasize = estimateSignatureSize(slice, {
    pieces: [requirements, ...(xml && der ? [xml, der] : [])],
    codeDirectories: algorithms.map((algorithm) => ({
      identifierLength: utf8Encode(options.identifier).byteLength,
      teamIdLength: teamId ? utf8Encode(teamId).byteLength : 0,
      pageSize,
      hashSize: DIGEST_SIZE[algorithm],
      nSpecialSlots: highestSpecialSlot(special),
    })),
    cmsReservation: policy.cmsReservation,
  });
  const prepared = prepareImage(slice, datasize);

  const text = findSegment(slice, "__TEXT");
  const execSegment = slice.buildVersion
    ? { base: text?.fileoff ?? 0n, limit: text?.filesize ?? 0n, flags: execSegmentFlags(slice, entitlements?.dict) }
    : undefined;
  const codeDirectories = await Promise.all(
    algorithms.map(async (algorithm) => ({
      algorithm,
      bytes: await buildCodeDirectory(
        {
          identifier: options.identifier,
          ...(teamId ? { teamId } : {}),
          flags: options.signing.kind === "adhoc" ? CS_ADHOC : 0,
          hashType: algorithm,
          pageSize,
          image: prepared.image,
          codeLimit: prepared.codeLimit,
          ...(execSegment ? { execSegment } : {}),
          special,
        },
        deps.hasher,
      ),
    })),
  );

  const cms =
    options.signing.kind === "identity"
      ? await signCodeDirectories(codeDirectories, options.signing.identity, deps.clock.now(), deps.hasher)
      : new Uint8Array(0);

  const entries: BlobEntry[] = [
    { slot: CSSLOT_REQUIREMENTS, blob: requirements },
    { slot: CSSLOT_SIGNATURESLOT, blob: blobWrapper(cms) },
    ...codeDirectories.map((cd, i) => ({
      slot: i === 0 ? CSSLOT_CODEDIRECTORY : CSSLOT_ALTERNATE_CODEDIRECTORIES + i - 1,
      blob: cd.bytes,
    })),
    ...(xml && der
      ? [
          { slot: CSSLOT_ENTITLEMENTS, blob: xml },
          { slot: CSSLOT_DER_ENTITLEMENTS, blob: der },
        ]
      : []),
  ];
  const superBlob = buildSuperBlob(entries);
  if (superBlob.byteLength > prepared.datasize) {
    throw new LoadstarError(ErrorCode.Unexpected, {
      message: "signature larger than its reservation",
      data: { signature: superBlob.byteLength, reserved: prepared.datasize },
    });
  }
  prepared.image.set(superBlob, prepared.codeLimit);

  const primary = codeDirectories[0] as { algorithm: HashAlgorithm; bytes: Uint8Array };
  deps.logger.debug("signed slice", {
    identifier: options.identifier,
    cputype: slice.cputype,
    pageSize,
    algorithms,
    codeLimit: prepared.codeLimit,
    signatureBytes: superBlob.byteLength,
    addedLoadCommand: prepared.addedLoadCommand,
  });
  return { bytes: prepared.image, cdhash: await cdHash(primary.bytes, primary.algorithm, deps.hasher) };
};

/** Signs a thin or universal Mach-O binary; output matches Apple codesign for the same inputs. */
export const signBinary = async (
  bytes: Uint8Array,
  options: SignBinaryOptions,
  deps: SignBinaryDeps,
): Promise<SignedBinary> => {
  const started = Date.now();
  options.signal?.throwIfAborted();
  const file = parseMachO(bytes, resolveLimits(options.limits).machO);
  const algorithms = hashAlgorithmsFor(file.slices, resolvePolicy(options.policy).hashAlgorithms);

  const signed: { bytes: Uint8Array; cdhash: Uint8Array }[] = [];
  for (const slice of file.slices) {
    options.signal?.throwIfAborted();
    signed.push(await signSlice(slice, algorithms, options, deps));
  }
  const output = file.fat
    ? assembleFat(
        file.fat,
        signed.map((s) => s.bytes),
      )
    : (signed[0]?.bytes ?? bytes);

  deps.logger.info("signed binary", {
    identifier: options.identifier,
    mode: options.signing.kind,
    slices: file.slices.length,
    algorithms,
    ms: Date.now() - started,
  });
  return { bytes: output, cdhashes: signed.map((s) => s.cdhash) };
};
