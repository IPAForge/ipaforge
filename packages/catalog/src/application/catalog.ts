// The catalog: which apps exist (remote manifest, built-in fallback), which release to install (GitHub API, with
// mirrors when a source has gone), and downloading it (streamed, size- and SHA-256-checked, cached).

import { type CatalogDeps, type CatalogDepsInput, resolveCatalogDeps } from "@catalog/deps.ts";
import { DEFAULT_MANIFEST } from "@catalog/domain/default-manifest.ts";
import {
  type CatalogApp,
  type Channel,
  type Manifest,
  manifestSchema,
  type ReleaseLocation,
  recommendedChannel,
} from "@catalog/domain/manifest.ts";
import type { ResolvedRelease } from "@catalog/domain/release.ts";
import { findGithubAsset } from "@catalog/infrastructure/github.ts";
import { ErrorCode, type FileSource, LoadstarError, readBody, toHex, utf8Decode } from "@loadstar/kernel";
import { sha256 } from "@noble/hashes/sha2.js";

const MAX_MANIFEST_BYTES = 1024 * 1024;

export interface DownloadProgress {
  readonly received: number;
  readonly total?: number;
}

export interface DownloadResult {
  readonly file: FileSource;
  /** SHA-256 of the downloaded bytes (verified against the expected value when one was known). */
  readonly sha256: string;
  /** True when it came from the download cache. */
  readonly cached: boolean;
}

export interface Catalog {
  /** The remote manifest when reachable (cached for `manifestTtlMs`), otherwise the built-in one. */
  manifest(signal?: AbortSignal): Promise<Manifest>;
  app(appId: string): Promise<CatalogApp>;
  /** The channel to suggest for this iOS version. */
  recommendedChannel(appId: string, iosVersion?: string): Promise<Channel>;
  /** Finds the release to download; tries mirrors when the primary source has gone. */
  resolve(appId: string, channel: Channel, signal?: AbortSignal): Promise<ResolvedRelease>;
  download(
    release: ResolvedRelease,
    options?: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal },
  ): Promise<DownloadResult>;
}

const cacheKey = (release: ResolvedRelease): string =>
  `${release.appId}/${release.channel}/${release.version}/${release.sha256 ?? release.size ?? "unknown"}/${release.fileName}`;

/** Counts and hashes bytes as they pass, and reports progress. */
const meter = (onChunk: (chunk: Uint8Array) => void) =>
  new TransformStream<Uint8Array, Uint8Array>({
    transform: (chunk, controller) => {
      onChunk(chunk);
      controller.enqueue(chunk);
    },
  });

export const createCatalog = (input: CatalogDepsInput): Catalog => {
  const deps: CatalogDeps = resolveCatalogDeps(input);
  const { logger, clock, config } = deps;
  let cached: { manifest: Manifest; at: number } | undefined;

  const fetchManifest = async (signal?: AbortSignal): Promise<Manifest> => {
    const timeout = AbortSignal.timeout(config.requestTimeoutMs);
    const response = await deps.http.request({
      method: "GET",
      url: config.manifestUrl,
      headers: { Accept: "application/json", "User-Agent": "Loadstar" },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    const body = await readBody(response, MAX_MANIFEST_BYTES);
    if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
    return manifestSchema.parse(JSON.parse(utf8Decode(body)));
  };

  const catalog: Catalog = {
    manifest: async (signal) => {
      const now = clock.now().getTime();
      if (cached && now - cached.at < config.manifestTtlMs) return cached.manifest;
      try {
        const manifest = await fetchManifest(signal);
        cached = { manifest, at: now };
        return manifest;
      } catch (error) {
        logger.warn("remote catalog unavailable; using the built-in one", { cause: error });
        return cached?.manifest ?? DEFAULT_MANIFEST;
      }
    },

    app: async (appId) => {
      const app = (await catalog.manifest()).apps.find((candidate) => candidate.id === appId);
      if (!app)
        throw new LoadstarError(ErrorCode.CatalogUnavailable, { message: `unknown app ${appId}`, data: { appId } });
      return app;
    },

    recommendedChannel: async (appId, iosVersion) => recommendedChannel(await catalog.app(appId), iosVersion),

    resolve: async (appId, channel, signal) => {
      const app = await catalog.app(appId);
      const release = app.channels[channel];
      if (!release) {
        throw new LoadstarError(ErrorCode.CatalogUnavailable, {
          message: `${app.name} has no ${channel} channel`,
          data: { appId, channel },
        });
      }
      const locations: { location: ReleaseLocation; from: "primary" | "mirror" }[] = [
        { location: release, from: "primary" },
        ...(release.mirrors ?? []).map((location) => ({ location, from: "mirror" as const })),
      ];
      const tried: string[] = [];
      for (const { location, from } of locations) {
        if ("url" in location) {
          const fileName = new URL(location.url).pathname.split("/").pop() || `${appId}.ipa`;
          return {
            appId,
            channel,
            version: "url",
            url: location.url,
            fileName,
            from,
            ...(location.size ? { size: location.size } : {}),
            ...(location.sha256 ? { sha256: location.sha256.toLowerCase() } : {}),
          };
        }
        const { repo, tag, asset } = location.github;
        tried.push(repo);
        try {
          const found = await findGithubAsset(deps, repo, tag, asset, signal);
          if (!found) {
            logger.warn("release source has gone; trying the next one", { repo, appId });
            continue;
          }
          const pinned = location.sha256?.toLowerCase();
          return {
            appId,
            channel,
            version: found.version,
            url: found.url,
            fileName: found.name,
            size: found.size,
            from,
            ...((pinned ?? found.sha256) ? { sha256: (pinned ?? found.sha256) as string } : {}),
            ...(found.publishedAt ? { publishedAt: found.publishedAt } : {}),
          };
        } catch (error) {
          if (error instanceof LoadstarError && error.code === ErrorCode.AssetNotFound) {
            logger.warn("release has no matching asset; trying the next source", { repo, appId });
            continue;
          }
          throw error;
        }
      }
      throw new LoadstarError(ErrorCode.ReleaseSourceGone, {
        message: `no source for ${app.name} (${channel}) is available`,
        data: { appId, channel, tried },
      });
    },

    download: async (release, options = {}) => {
      const key = cacheKey(release);
      const existing = release.sha256 ? await deps.store.get(key) : undefined;
      if (existing && release.sha256) {
        // The cache only ever holds verified files (DownloadStore keeps an entry after verify()).
        logger.debug("using cached download", { appId: release.appId, version: release.version });
        return { file: existing, sha256: release.sha256, cached: true };
      }
      // Fail closed: every download is verified against a checksum from the manifest or GitHub.
      if (!release.sha256) {
        throw new LoadstarError(ErrorCode.ChecksumMissing, {
          message: "no published checksum for this release; refusing to install an unverified file",
          data: { appId: release.appId, version: release.version },
        });
      }
      if (!release.url.startsWith("https://")) {
        throw new LoadstarError(ErrorCode.DownloadFailed, {
          message: "release URL is not HTTPS",
          data: { appId: release.appId },
        });
      }
      if (release.size !== undefined && release.size > config.maxDownloadBytes) {
        throw new LoadstarError(ErrorCode.DownloadFailed, {
          message: "file is larger than allowed",
          data: { size: release.size },
        });
      }
      const response = await deps.http.request({
        method: "GET",
        url: release.url,
        headers: { "User-Agent": "Loadstar", Accept: "application/octet-stream" },
        ...(options.signal ? { signal: options.signal } : {}),
      });
      if (response.status !== 200) {
        await response.body.cancel().catch(() => {});
        throw new LoadstarError(response.status === 404 ? ErrorCode.ReleaseSourceGone : ErrorCode.DownloadFailed, {
          message: `download answered HTTP ${response.status}`,
          data: { status: response.status, host: new URL(release.url).host },
        });
      }
      const hash = sha256.create();
      let received = 0;
      const total = release.size;
      const counted = response.body.pipeThrough(
        meter((chunk) => {
          received += chunk.byteLength;
          if (received > config.maxDownloadBytes) throw new Error("download exceeds the size limit");
          hash.update(chunk);
          options.onProgress?.({ received, ...(total === undefined ? {} : { total }) });
        }),
      );
      let digest = "";
      const file = await deps.store.put(key, counted, async () => {
        digest = toHex(hash.digest());
        if (total !== undefined && received !== total) {
          throw new LoadstarError(ErrorCode.DownloadFailed, {
            message: `incomplete download: ${received} of ${total} bytes`,
            data: { received, total },
          });
        }
        if (digest !== release.sha256) {
          throw new LoadstarError(ErrorCode.ChecksumMismatch, {
            message: "the downloaded file does not match its published checksum",
            data: { appId: release.appId, version: release.version },
          });
        }
      });
      logger.info("downloaded", {
        appId: release.appId,
        version: release.version,
        bytes: received,
        from: release.from,
      });
      return { file, sha256: digest, cached: false };
    },
  };
  return catalog;
};
