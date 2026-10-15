// Maintainer tool: checks the catalog against the real manifest and GitHub (no account needed).
//
//   pnpm --filter @loadstar/desktop catalog-probe              # resolve every app and channel
//   pnpm --filter @loadstar/desktop catalog-probe download sidestore stable   # also download (to a temp cache)
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFileDownloadStore } from "@desktop/main/adapters/file-download-store.ts";
import { createNodeHttpClient } from "@desktop/main/adapters/http-client.ts";
import { type Channel, createCatalog } from "@loadstar/catalog";
import { LoadstarError } from "@loadstar/kernel";

const [command = "resolve", appId, channel] = process.argv.slice(2);
const cacheDir = await mkdtemp(join(tmpdir(), "loadstar-catalog-"));
const catalog = createCatalog({ http: createNodeHttpClient(), store: createFileDownloadStore(cacheDir) });
const describe = (error: unknown) =>
  error instanceof LoadstarError ? `${error.code} ${JSON.stringify(error.data ?? {})}` : String(error);

const manifest = await catalog.manifest();
for (const app of manifest.apps) {
  for (const name of ["stable", "nightly"] as const) {
    if (!app.channels[name]) continue;
    try {
      const release = await catalog.resolve(app.id, name);
      console.log(
        `${app.id} ${name}: ${release.version} ${release.fileName} ${release.size ?? "?"} bytes, sha256 ${release.sha256 ? "published" : "not published"}, from ${release.from}`,
      );
    } catch (error) {
      console.log(`${app.id} ${name}: ✗ ${describe(error)}`);
    }
  }
}
if (command === "download" && appId && channel) {
  const release = await catalog.resolve(appId, channel as Channel);
  let last = 0;
  const result = await catalog.download(release, {
    onProgress: ({ received, total }) => {
      const percent = total ? Math.floor((received / total) * 100) : 0;
      if (percent >= last + 25) {
        last = percent;
        console.log(`  ${percent}%`);
      }
    },
  });
  console.log(`downloaded ${result.file.size} bytes, sha256 ${result.sha256.slice(0, 16)}…, cache ${cacheDir}`);
}
