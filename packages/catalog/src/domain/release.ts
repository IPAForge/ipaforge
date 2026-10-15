import type { Channel } from "@catalog/domain/manifest.ts";

/** A concrete, downloadable release of a catalog app. */
export interface ResolvedRelease {
  readonly appId: string;
  readonly channel: Channel;
  /** Release tag or version, e.g. "0.7.0" or "nightly". */
  readonly version: string;
  readonly url: string;
  readonly fileName: string;
  readonly size?: number;
  /** Expected SHA-256 (hex), from the manifest pin or GitHub's asset digest. */
  readonly sha256?: string;
  readonly publishedAt?: Date;
  /** Which location answered: the primary source or a mirror. */
  readonly from: "primary" | "mirror";
}
