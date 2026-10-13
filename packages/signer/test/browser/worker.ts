// Runs inside a browser Web Worker: the exact signer code, signing a bundle sent by the test.
import { fixedClock, fromBase64, silentLogger, toBase64 } from "@loadstar/kernel";
import { type BundleTree, createHasher, isPlistDict, parsePlist, signBundle } from "@signer/index.ts";

export interface ParityRequest {
  readonly files: readonly { path: string; kind: "file" | "symlink"; data: string; mode: number }[];
  readonly certificate: string;
  readonly pkcs8: string;
  readonly teamId: string;
  readonly signingTime: string;
  readonly entitlements: Readonly<Record<string, string>>; // bundle kind → plist (base64)
}

export interface ParityResponse {
  readonly files: readonly { path: string; data: string }[];
  readonly ms: number;
  readonly hasher: string;
  readonly userAgent: string;
}

const entitlementsFor = (request: ParityRequest, kind: string) => {
  const encoded = request.entitlements[kind];
  if (!encoded) return undefined;
  const bytes = fromBase64(encoded);
  const dict = parsePlist(bytes);
  return isPlistDict(dict) ? { bytes, dict } : undefined;
};

self.onmessage = async (event: MessageEvent<ParityRequest>) => {
  const request = event.data;
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    fromBase64(request.pkcs8) as Uint8Array<ArrayBuffer>,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const tree: BundleTree = new Map(
    request.files.map((f) => [
      f.path,
      f.kind === "symlink"
        ? { kind: "symlink", target: new TextDecoder().decode(fromBase64(f.data)), mode: f.mode }
        : { kind: "file", data: fromBase64(f.data), mode: f.mode },
    ]),
  );

  const hasher = createHasher();
  const started = performance.now();
  await signBundle(
    tree,
    {
      configFor: (bundle) => {
        const entitlements = entitlementsFor(request, bundle.kind);
        return {
          signing: {
            kind: "identity",
            identity: { certificate: fromBase64(request.certificate), chain: [], privateKey },
            teamId: request.teamId,
          },
          ...(entitlements ? { entitlements } : {}),
        };
      },
    },
    { hasher, logger: silentLogger, clock: fixedClock(new Date(request.signingTime)) },
  );

  const response: ParityResponse = {
    files: [...tree].map(([path, entry]) => ({
      path,
      data: toBase64(entry.kind === "file" ? entry.data : new TextEncoder().encode(entry.target)),
    })),
    ms: performance.now() - started,
    hasher: hasher.kind,
    userAgent: navigator.userAgent,
  };
  self.postMessage(response);
};
