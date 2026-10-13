import { createHash } from "node:crypto";
import { toHex, utf8Encode } from "@loadstar/kernel";
import {
  createHasher,
  createNobleHasher,
  createWebCryptoHasher,
  type HashAlgorithm,
} from "@signer/infrastructure/hashing/index.ts";
import { describe, expect, it } from "vitest";

const hashers = [createWebCryptoHasher(globalThis.crypto.subtle), createNobleHasher()];
const algorithms: HashAlgorithm[] = ["sha1", "sha256"];

const randomBytes = (length: number): Uint8Array => {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i += 65536) crypto.getRandomValues(out.subarray(i, Math.min(i + 65536, length)));
  return out;
};

const nodeDigest = (algorithm: HashAlgorithm, data: Uint8Array): string =>
  createHash(algorithm).update(data).digest("hex");

describe.each(hashers.map((h) => [h.kind, h] as const))("%s hasher", (_kind, hasher) => {
  it.each(algorithms)("%s matches known vectors", async (algorithm) => {
    const expected = {
      sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    };
    expect(toHex(await hasher.digest(algorithm, utf8Encode("abc")))).toBe(expected[algorithm]);
  });

  it.each(algorithms)("%s page hashes match node:crypto, including a short last page", async (algorithm) => {
    const data = randomBytes(4096 * 300 + 1234);
    const pages = await hasher.digestPages(algorithm, data, 4096);
    expect(pages).toHaveLength(301);
    pages.forEach((page, i) => {
      expect(toHex(page)).toBe(nodeDigest(algorithm, data.subarray(i * 4096, Math.min((i + 1) * 4096, data.length))));
    });
  });

  it("handles 16 KiB pages and empty input", async () => {
    const data = randomBytes(16384 * 2);
    expect(await hasher.digestPages("sha256", data, 16384)).toHaveLength(2);
    expect(await hasher.digestPages("sha256", new Uint8Array(0), 4096)).toEqual([]);
  });
});

describe("createHasher", () => {
  it("prefers WebCrypto when available", () => {
    expect(createHasher().kind).toBe("webcrypto");
  });

  it("produces identical page hashes with both implementations", async () => {
    const data = randomBytes(4096 * 50 + 7);
    const [a, b] = await Promise.all(hashers.map((h) => h.digestPages("sha256", data, 4096)));
    expect(a?.map(toHex)).toEqual(b?.map(toHex));
  });
});

describe.skipIf(!process.env.LOADSTAR_BENCH)("throughput (LOADSTAR_BENCH=1)", () => {
  // WebCrypto is the production path; noble is a fallback for contexts without crypto.subtle.
  const floors: Record<string, number> = { webcrypto: 300, noble: 100 };
  it.each(hashers.map((h) => [h.kind, h] as const))(
    "%s meets its throughput floor (4 KiB pages)",
    async (_kind, hasher) => {
      const data = randomBytes(128 * 1024 * 1024);
      const started = performance.now();
      await hasher.digestPages("sha256", data, 4096);
      const mbPerSecond = data.length / 1024 / 1024 / ((performance.now() - started) / 1000);
      console.info(`[bench] ${hasher.kind}: ${mbPerSecond.toFixed(0)} MB/s`);
      expect(mbPerSecond).toBeGreaterThan(floors[hasher.kind] ?? 0);
    },
  );
});
