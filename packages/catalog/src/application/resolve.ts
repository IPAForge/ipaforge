// Which release to download: the primary source first, then each mirror. A source that has gone, has no matching
// asset, or publishes no checksum is skipped; only verifiable releases are returned.
import type { CatalogDeps } from "@catalog/deps.ts";
import type { CatalogApp, Channel, GithubLocation, ReleaseLocation, UrlLocation } from "@catalog/domain/manifest.ts";
import type { ResolvedRelease } from "@catalog/domain/release.ts";
import { findGithubAsset } from "@catalog/infrastructure/github.ts";
import { compact, ErrorCode, LoadstarError } from "@loadstar/kernel";

type Origin = ResolvedRelease["from"];

interface Source {
  readonly location: ReleaseLocation;
  readonly from: Origin;
}

/** Why a source produced no release (kept for the final error). */
type Skip = { readonly source: string; readonly reason: "gone" | "no-asset" | "no-checksum" };

type Attempt = { readonly release: ResolvedRelease } | { readonly skip: Skip };

const sourcesOf = (app: CatalogApp, channel: Channel): Source[] => {
  const release = app.channels[channel];
  if (!release) {
    throw new LoadstarError(ErrorCode.CatalogUnavailable, {
      message: `${app.name} has no ${channel} channel`,
      data: { appId: app.id, channel },
    });
  }
  return [
    { location: release, from: "primary" },
    ...(release.mirrors ?? []).map((location): Source => ({ location, from: "mirror" })),
  ];
};

const fileNameOf = (url: string, fallback: string): string => new URL(url).pathname.split("/").pop() || fallback;

const fromUrl = (app: CatalogApp, channel: Channel, location: UrlLocation, from: Origin): Attempt => {
  const release: ResolvedRelease = compact({
    appId: app.id,
    channel,
    version: "url",
    url: location.url,
    fileName: fileNameOf(location.url, `${app.id}.ipa`),
    size: location.size,
    sha256: location.sha256.toLowerCase(),
    from,
  });
  return { release };
};

const fromGithub = async (
  deps: CatalogDeps,
  app: CatalogApp,
  channel: Channel,
  location: GithubLocation,
  from: Origin,
  signal?: AbortSignal,
): Promise<Attempt> => {
  const { repo } = location.github;
  const lookup = await findGithubAsset(deps, location.github, signal);
  if (lookup.kind !== "found") return { skip: { source: repo, reason: lookup.kind } };
  const checksum = location.sha256?.toLowerCase() ?? lookup.asset.sha256;
  if (!checksum) return { skip: { source: repo, reason: "no-checksum" } };
  const { asset } = lookup;
  const release: ResolvedRelease = compact({
    appId: app.id,
    channel,
    version: asset.version,
    url: asset.url,
    fileName: asset.name,
    size: asset.size,
    sha256: checksum,
    publishedAt: asset.publishedAt,
    from,
  });
  return { release };
};

const isUrlLocation = (location: ReleaseLocation): location is UrlLocation => "url" in location;

const attempt = async (
  deps: CatalogDeps,
  app: CatalogApp,
  channel: Channel,
  { location, from }: Source,
  signal?: AbortSignal,
): Promise<Attempt> =>
  isUrlLocation(location)
    ? fromUrl(app, channel, location, from)
    : fromGithub(deps, app, channel, location, from, signal);

const noReleaseError = (app: CatalogApp, channel: Channel, skipped: readonly Skip[]): LoadstarError =>
  new LoadstarError(
    skipped.some((skip) => skip.reason === "no-checksum") ? ErrorCode.ChecksumMissing : ErrorCode.ReleaseSourceGone,
    { message: `no usable source for ${app.name} (${channel})`, data: { appId: app.id, channel, skipped } },
  );

export const resolveRelease = async (
  deps: CatalogDeps,
  app: CatalogApp,
  channel: Channel,
  signal?: AbortSignal,
): Promise<ResolvedRelease> => {
  const skipped: Skip[] = [];
  for (const source of sourcesOf(app, channel)) {
    const result = await attempt(deps, app, channel, source, signal);
    if ("release" in result) return result.release;
    skipped.push(result.skip);
    deps.logger.warn("release source unusable; trying the next one", { appId: app.id, ...result.skip });
  }
  throw noReleaseError(app, channel, skipped);
};
