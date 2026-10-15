// The inputs every signing operation shares: how to sign, and what a signature carries.
import type { PlistDict } from "@loadstar/kernel";
import type { DesignatedRequirement } from "@signer/domain/blobs/index.ts";
import type { SigningIdentity } from "@signer/infrastructure/cms/sign.ts";

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

/** What one Mach-O signature is made of, besides the binary itself. */
export interface SignatureContent {
  readonly identifier: string;
  readonly signing: SigningMode;
  readonly entitlements?: EntitlementsInput;
  /** Bundle executables only: Info.plist bytes (slot −1) and CodeResources bytes (slot −3). */
  readonly infoPlist?: Uint8Array;
  readonly codeResources?: Uint8Array;
}
