// The catalog facade: which apps exist, which release to install, and downloading it safely.
import { type DownloadOptions, type DownloadResult, downloadRelease } from "@catalog/application/download.ts";
import { createManifestSource } from "@catalog/application/manifest-source.ts";
import { resolveRelease } from "@catalog/application/resolve.ts";
import { type CatalogDepsInput, resolveCatalogDeps } from "@catalog/deps.ts";
import { type CatalogApp, type Channel, type Manifest, recommendedChannel } from "@catalog/domain/manifest.ts";
import type { ResolvedRelease } from "@catalog/domain/release.ts";
import { ErrorCode, LoadstarError } from "@loadstar/kernel";

export type { DownloadOptions, DownloadProgress, DownloadResult } from "@catalog/application/download.ts";

export interface Catalog {
  /** The remote manifest when reachable, otherwise the built-in one. */
  manifest(signal?: AbortSignal): Promise<Manifest>;
  app(appId: string): Promise<CatalogApp>;
  /** The channel to suggest for this iOS version. */
  recommendedChannel(appId: string, iosVersion?: string): Promise<Channel>;
  /** The release to download; tries mirrors when the primary source is unusable. Always carries a checksum. */
  resolve(appId: string, channel: Channel, signal?: AbortSignal): Promise<ResolvedRelease>;
  download(release: ResolvedRelease, options?: DownloadOptions): Promise<DownloadResult>;
}

export const createCatalog = (input: CatalogDepsInput): Catalog => {
  const deps = resolveCatalogDeps(input);
  const manifest = createManifestSource(deps);

  const app = async (appId: string): Promise<CatalogApp> => {
    const found = (await manifest()).apps.find((candidate) => candidate.id === appId);
    if (!found)
      throw new LoadstarError(ErrorCode.CatalogUnavailable, { message: `unknown app ${appId}`, data: { appId } });
    return found;
  };

  return {
    manifest,
    app,
    recommendedChannel: async (appId, iosVersion) => recommendedChannel(await app(appId), iosVersion),
    resolve: async (appId, channel, signal) => resolveRelease(deps, await app(appId), channel, signal),
    download: (release, options) => downloadRelease(deps, release, options),
  };
};
