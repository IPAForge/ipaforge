// Opens the IPAs the UI names: a picked file is read where it is; a URL is downloaded into the download store first.
// Catalog apps never get here: the install flows download and verify them themselves.
import { createHash } from "node:crypto";
import { nodeFileSource } from "@desktop/main/adapters/file-source.ts";
import type { DownloadStore } from "@loadstar/catalog";
import { ErrorCode, type FileSource, type HttpClient, LoadstarError } from "@loadstar/kernel";
import type { ResolveIpa } from "@loadstar/rpc";

export interface IpaResolverDeps {
  readonly http: HttpClient;
  readonly store: DownloadStore;
}

const openFile = async (path: string): Promise<FileSource> => {
  try {
    return await nodeFileSource(path);
  } catch (cause) {
    throw new LoadstarError(ErrorCode.InvalidBundle, { message: "the picked IPA cannot be read", cause });
  }
};

/** Name for a URL whose path does not end in one. */
const FALLBACK_NAME = "download.ipa";

/** One store entry per URL; the last path segment keeps the file's name for the UI. */
const urlKey = (url: string): string => {
  const name = new URL(url).pathname.split("/").pop() || FALLBACK_NAME;
  return `urls/${createHash("sha256").update(url).digest("hex")}/${name}`;
};

const download = async ({ http, store }: IpaResolverDeps, url: string, signal: AbortSignal): Promise<FileSource> => {
  const response = await http.request({ method: "GET", url, signal });
  if (response.status < 200 || response.status >= 300) {
    await response.body.cancel();
    throw new LoadstarError(ErrorCode.DownloadFailed, {
      message: "IPA download failed",
      data: { status: response.status },
    });
  }
  // A URL comes with no checksum to check: the signer's inspection is what validates the file.
  return store.put(urlKey(url), response.body, async () => {});
};

export const createIpaResolver =
  (deps: IpaResolverDeps): ResolveIpa =>
  (ipa, signal) =>
    ipa.kind === "file" ? openFile(ipa.path) : download(deps, ipa.url, signal);
