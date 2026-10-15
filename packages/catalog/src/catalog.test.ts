import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCatalog } from "@catalog/application/catalog.ts";
import { DEFAULT_MANIFEST } from "@catalog/domain/default-manifest.ts";
import { type CatalogApp, manifestSchema, recommendedChannel, supportsIos } from "@catalog/domain/manifest.ts";
import type { DownloadStore } from "@catalog/domain/ports/download-store.ts";
import {
  bytesFileSource,
  ErrorCode,
  type FileSource,
  type HttpRequest,
  type HttpResponse,
  toHex,
  utf8Encode,
} from "@loadstar/kernel";
import { sha256 } from "@noble/hashes/sha2.js";
import { describe, expect, it } from "vitest";

const respond = (status: number, body: string | Uint8Array, headers: Record<string, string> = {}): HttpResponse => ({
  status,
  headers,
  body: new ReadableStream({
    start: (controller) => {
      controller.enqueue(typeof body === "string" ? utf8Encode(body) : body);
      controller.close();
    },
  }),
});

const ipa = utf8Encode("PK fake ipa bytes");
const ipaSha = toHex(sha256(ipa));

const githubRelease = (asset: string, digest?: string) =>
  JSON.stringify({
    tag_name: "0.7.0",
    published_at: "2026-09-11T00:00:00Z",
    assets: [
      {
        name: asset,
        browser_download_url: `https://github.com/x/y/releases/download/0.7.0/${asset}`,
        size: ipa.byteLength,
        ...(digest ? { digest: `sha256:${digest}` } : {}),
      },
    ],
  });

/** A fake HTTP client routing by URL substring. */
const fakeHttp = (routes: Record<string, () => HttpResponse>) => {
  const requested: string[] = [];
  return {
    requested,
    client: {
      request: async (request: HttpRequest) => {
        requested.push(request.url);
        const match = Object.entries(routes).find(([fragment]) => request.url.includes(fragment));
        return match ? match[1]() : respond(404, "not found");
      },
    },
  };
};

const memoryStore = (): DownloadStore & { entries: Map<string, Uint8Array> } => {
  const entries = new Map<string, Uint8Array>();
  return {
    entries,
    get: async (key) => {
      const bytes = entries.get(key);
      return bytes ? bytesFileSource(key, bytes) : undefined;
    },
    put: async (key, stream, verify): Promise<FileSource> => {
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) chunks.push(chunk);
      const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      await verify();
      entries.set(key, bytes);
      return bytesFileSource(key, bytes);
    },
    delete: async (key) => {
      entries.delete(key);
    },
  };
};

describe("manifest", () => {
  it("the built-in manifest equals catalog/sources.json and is valid", () => {
    const file = JSON.parse(readFileSync(join(import.meta.dirname, "../../../catalog/sources.json"), "utf8"));
    expect(DEFAULT_MANIFEST).toEqual(file);
    expect(manifestSchema.safeParse(file).success).toBe(true);
  });

  it("recommends a channel per iOS version and checks the minimum", () => {
    const app: CatalogApp = {
      id: "x",
      name: "X",
      bundleId: "com.x",
      kind: "sidestore",
      minimumIos: "15.0",
      channels: {
        stable: { github: { repo: "a/b", asset: "X.ipa" } },
        nightly: { github: { repo: "a/b", tag: "nightly", asset: "X.ipa" } },
      },
      compatibility: [{ iosFrom: "26.4", channel: "nightly" }],
    };
    expect(recommendedChannel(app, "26.3.1")).toBe("stable");
    expect(recommendedChannel(app, "26.4")).toBe("nightly");
    expect(recommendedChannel(app)).toBe("stable");
    expect(supportsIos(app, "14.8")).toBe(false);
    expect(supportsIos(app, "15.0")).toBe(true);
  });

  it("falls back to the built-in manifest when the remote one is unavailable or invalid", async () => {
    const http = fakeHttp({ "sources.json": () => respond(200, '{"version": 2}') });
    const catalog = createCatalog({ http: http.client, store: memoryStore() });
    expect(await catalog.manifest()).toEqual(DEFAULT_MANIFEST);
  });
});

describe("release resolution", () => {
  it("uses GitHub's asset digest when there is one", async () => {
    const http = fakeHttp({
      "SideStore/SideStore/releases/latest": () => respond(200, githubRelease("SideStore.ipa", ipaSha)),
    });
    const catalog = createCatalog({
      http: http.client,
      store: memoryStore(),
      config: { manifestUrl: "https://example.invalid/m.json" },
    });
    const release = await catalog.resolve("sidestore", "stable");
    expect(release).toMatchObject({ version: "0.7.0", fileName: "SideStore.ipa", sha256: ipaSha, from: "primary" });
  });

  it("falls back to a mirror when the source repository has gone", async () => {
    const http = fakeHttp({
      "LiveContainerMirror/LiveContainer/releases/latest": () =>
        respond(200, githubRelease("LiveContainer+SideStore.ipa")),
    });
    const catalog = createCatalog({
      http: http.client,
      store: memoryStore(),
      config: { manifestUrl: "https://example.invalid/m.json" },
    });
    const release = await catalog.resolve("livecontainer-sidestore", "stable");
    expect(release.from).toBe("mirror");
    expect(http.requested.some((url) => url.includes("/repos/LiveContainer/LiveContainer/"))).toBe(true);
  });

  it("reports a source that has gone everywhere, and GitHub rate limits", async () => {
    const gone = createCatalog({
      http: fakeHttp({}).client,
      store: memoryStore(),
      config: { manifestUrl: "https://example.invalid/m.json" },
    });
    await expect(gone.resolve("livecontainer-sidestore", "nightly")).rejects.toMatchObject({
      code: ErrorCode.ReleaseSourceGone,
    });
    const limited = createCatalog({
      http: fakeHttp({ "releases/latest": () => respond(403, "{}", { "x-ratelimit-remaining": "0" }) }).client,
      store: memoryStore(),
      config: { manifestUrl: "https://example.invalid/m.json" },
    });
    await expect(limited.resolve("sidestore", "stable")).rejects.toMatchObject({ code: ErrorCode.GithubRateLimited });
  });
});

describe("downloads", () => {
  const release = {
    appId: "sidestore",
    channel: "stable" as const,
    version: "0.7.0",
    url: "https://github.com/x/y/releases/download/0.7.0/SideStore.ipa",
    fileName: "SideStore.ipa",
    size: ipa.byteLength,
    sha256: ipaSha,
    from: "primary" as const,
  };

  it("streams, verifies size and SHA-256, reports progress and caches", async () => {
    const store = memoryStore();
    const http = fakeHttp({ "SideStore.ipa": () => respond(200, ipa) });
    const catalog = createCatalog({ http: http.client, store });
    const progress: number[] = [];
    const first = await catalog.download(release, { onProgress: (p) => progress.push(p.received) });
    expect(first).toMatchObject({ sha256: ipaSha, cached: false });
    expect(progress.at(-1)).toBe(ipa.byteLength);
    const second = await catalog.download(release);
    expect(second.cached).toBe(true);
    expect(http.requested.filter((url) => url.endsWith("SideStore.ipa"))).toHaveLength(1);
  });

  it("refuses a file whose checksum or size does not match, and keeps nothing", async () => {
    const store = memoryStore();
    const tampered = createCatalog({
      http: fakeHttp({ "SideStore.ipa": () => respond(200, utf8Encode("PK other bytes!!!")) }).client,
      store,
    });
    await expect(tampered.download(release)).rejects.toMatchObject({ code: ErrorCode.ChecksumMismatch });
    const truncated = createCatalog({
      http: fakeHttp({ "SideStore.ipa": () => respond(200, ipa.subarray(0, 4)) }).client,
      store,
    });
    await expect(truncated.download(release)).rejects.toMatchObject({ code: ErrorCode.DownloadFailed });
    expect(store.entries.size).toBe(0);
  });

  it("refuses to download a release without a known checksum (fails closed)", async () => {
    const http = fakeHttp({ "SideStore.ipa": () => respond(200, ipa) });
    const catalog = createCatalog({ http: http.client, store: memoryStore() });
    const { sha256: _omit, ...unverified } = release;
    await expect(catalog.download(unverified)).rejects.toMatchObject({ code: ErrorCode.ChecksumMissing });
    expect(http.requested).toHaveLength(0);
  });

  it("rejects manifest URL entries without a checksum", () => {
    const entry = {
      id: "x",
      name: "X",
      bundleId: "com.x",
      kind: "app",
      channels: { stable: { url: "https://example.com/X.ipa" } },
    };
    expect(manifestSchema.safeParse({ version: 1, apps: [entry] }).success).toBe(false);
  });

  it("maps a missing download to source_gone", async () => {
    const catalog = createCatalog({ http: fakeHttp({}).client, store: memoryStore() });
    await expect(catalog.download(release)).rejects.toMatchObject({ code: ErrorCode.ReleaseSourceGone });
  });
});
