// GitHub release lookup through the REST API. A missing repository or release (404) is a normal, expected
// outcome (projects move or disappear) and is reported as `undefined` so the caller can try a mirror.

import type { CatalogDeps } from "@catalog/deps.ts";
import { ErrorCode, LoadstarError, readBody, utf8Decode } from "@loadstar/kernel";
import { z } from "zod";

const releaseSchema = z.looseObject({
  tag_name: z.string(),
  published_at: z.string().nullable().optional(),
  assets: z.array(
    z.looseObject({
      name: z.string(),
      browser_download_url: z.string().url(),
      size: z.number().int().nonnegative(),
      /** "sha256:<hex>" (GitHub computes it for assets uploaded since mid-2025). */
      digest: z.string().nullable().optional(),
    }),
  ),
});

export interface GithubAsset {
  readonly version: string;
  readonly url: string;
  readonly name: string;
  readonly size: number;
  readonly sha256?: string;
  readonly publishedAt?: Date;
}

const MAX_API_BYTES = 8 * 1024 * 1024;

export const findGithubAsset = async (
  deps: CatalogDeps,
  repo: string,
  tag: string | undefined,
  asset: string,
  signal?: AbortSignal,
): Promise<GithubAsset | undefined> => {
  const path = tag ? `releases/tags/${encodeURIComponent(tag)}` : "releases/latest";
  const url = `${deps.config.githubApi}/repos/${repo}/${path}`;
  const timeout = AbortSignal.timeout(deps.config.requestTimeoutMs);
  const response = await deps.http.request({
    method: "GET",
    url,
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Loadstar",
    },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const body = await readBody(response, MAX_API_BYTES);
  if (response.status === 404) return undefined;
  const remaining = Object.entries(response.headers).find(([k]) => k.toLowerCase() === "x-ratelimit-remaining")?.[1];
  if (response.status === 429 || (response.status === 403 && remaining === "0")) {
    throw new LoadstarError(ErrorCode.GithubRateLimited, { data: { repo } });
  }
  if (response.status < 200 || response.status >= 300) {
    throw new LoadstarError(ErrorCode.CatalogUnavailable, {
      message: `GitHub answered HTTP ${response.status} for ${repo}`,
      data: { repo, status: response.status },
    });
  }
  const release = releaseSchema.parse(JSON.parse(utf8Decode(body)));
  const found = release.assets.find((candidate) => candidate.name === asset);
  if (!found) {
    throw new LoadstarError(ErrorCode.AssetNotFound, {
      message: `${repo} ${release.tag_name} has no asset named ${asset}`,
      data: { repo, version: release.tag_name, asset },
    });
  }
  if (!found.browser_download_url.startsWith("https://")) {
    throw new LoadstarError(ErrorCode.CatalogUnavailable, {
      message: `${repo}: asset URL is not HTTPS`,
      data: { repo },
    });
  }
  const digest = found.digest?.startsWith("sha256:") ? found.digest.slice("sha256:".length).toLowerCase() : undefined;
  return {
    version: release.tag_name,
    url: found.browser_download_url,
    name: found.name,
    size: found.size,
    ...(digest ? { sha256: digest } : {}),
    ...(release.published_at ? { publishedAt: new Date(release.published_at) } : {}),
  };
};
