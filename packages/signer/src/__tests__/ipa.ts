// Test-only: the golden Test.app fixture packed as an .ipa.
import { join } from "node:path";
import { bytesFileSource, concatBytes, type FileSource, silentLogger } from "@loadstar/kernel";
import { FIXTURES_DIR, readTree } from "@signer/__tests__/fixtures.ts";
import type { BundleTree } from "@signer/domain/bundle/tree.ts";
import { writeIpa } from "@signer/infrastructure/ipa/index.ts";

export const collect = async (stream: ReadableStream<Uint8Array>): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return concatBytes(chunks);
};

export const fixtureIpaSource = async (): Promise<FileSource> => {
  const app: BundleTree = new Map(
    readTree(join(FIXTURES_DIR, "expected/Test.app")).map((e) => [
      e.path,
      e.kind === "symlink"
        ? { kind: "symlink" as const, target: e.target ?? "", mode: 0o755 }
        : { kind: "file" as const, data: e.data ?? new Uint8Array(), mode: e.mode },
    ]),
  );
  const ipa = await collect(writeIpa({ appName: "Test.app", app, extras: new Map() }, { logger: silentLogger }));
  return bytesFileSource("Test.ipa", ipa);
};
