// Browser parity: the signer must produce byte-identical output in a Chromium Web Worker and in Node.
// Opt-in (LOADSTAR_BROWSER=1); CI runs it on Linux with Playwright's Chromium.
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { join } from "node:path";
import { fixedClock, fromBase64, silentLogger, toBase64, toHex } from "@loadstar/kernel";
import { FIXTURES_DIR, readTree } from "@signer/__tests__/fixtures.ts";
import { createTestIdentity } from "@signer/__tests__/identity.ts";
import { type BundleTree, createHasher, isPlistDict, parsePlist, signBundle } from "@signer/index.ts";
import type { ParityRequest, ParityResponse } from "@signer-test/browser/worker.ts";
import { build } from "esbuild";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SIGNING_TIME = "2026-10-13T12:00:00Z";
const TEAM = "ABCDE12345";

let server: Server;
let browser: Browser;
let origin: string;

const launch = async (): Promise<Browser> => {
  const channel = process.env.LOADSTAR_BROWSER_CHANNEL;
  if (channel) return chromium.launch({ channel });
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ channel: "chrome" }); // fall back to an installed Google Chrome
  }
};

const fixtureTree = (): BundleTree =>
  new Map(
    readTree(join(FIXTURES_DIR, "inputs/Test.app")).map((e) => [
      e.path,
      e.kind === "symlink"
        ? { kind: "symlink" as const, target: e.target ?? "", mode: e.mode }
        : { kind: "file" as const, data: e.data ?? new Uint8Array(), mode: e.mode },
    ]),
  );

describe.skipIf(!process.env.LOADSTAR_BROWSER)("browser parity (LOADSTAR_BROWSER=1)", () => {
  beforeAll(async () => {
    const bundle = await build({
      entryPoints: [join(import.meta.dirname, "browser/worker.ts")],
      bundle: true,
      format: "esm",
      platform: "browser",
      target: "chrome120",
      write: false,
      logLevel: "warning",
    });
    const workerJs = bundle.outputFiles[0]?.text ?? "";
    const page = `<!doctype html><script type="module">
      window.runParity = (request) => new Promise((resolve, reject) => {
        const worker = new Worker("/worker.js", { type: "module" });
        worker.onmessage = (event) => { resolve(event.data); worker.terminate(); };
        worker.onerror = (event) => reject(new Error(event.message));
        worker.postMessage(request);
      });
    </script>`;
    server = createServer((req, res) => {
      const js = req.url === "/worker.js";
      res.writeHead(200, { "content-type": js ? "text/javascript" : "text/html" });
      res.end(js ? workerJs : page);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    origin = `http://localhost:${typeof address === "object" && address ? address.port : 0}`; // localhost = secure context
    browser = await launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    server?.close();
  });

  it("signs Test.app byte-identically in a Chromium Web Worker and in Node", async () => {
    const identity = await createTestIdentity({ teamId: TEAM });
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", identity.privateKey));
    const entitlements = {
      app: toBase64(readFileSync(join(FIXTURES_DIR, "entitlements/app.plist"))),
      appex: toBase64(readFileSync(join(FIXTURES_DIR, "entitlements/appex.plist"))),
    };

    // Browser
    const tree = fixtureTree();
    const request: ParityRequest = {
      files: [...tree].map(([path, entry]) => ({
        path,
        kind: entry.kind,
        mode: entry.mode,
        data: toBase64(entry.kind === "file" ? entry.data : new TextEncoder().encode(entry.target)),
      })),
      certificate: toBase64(identity.certificate),
      pkcs8: toBase64(pkcs8),
      teamId: TEAM,
      signingTime: SIGNING_TIME,
      entitlements,
    };
    const page = await browser.newPage();
    await page.goto(origin);
    const browserResult = (await page.evaluate(
      (r) => (globalThis as unknown as { runParity: (r: unknown) => Promise<unknown> }).runParity(r),
      request,
    )) as ParityResponse;
    await page.close();

    // Node, same inputs
    const hasher = createHasher();
    await signBundle(
      tree,
      {
        configFor: (bundle) => {
          const encoded = entitlements[bundle.kind as keyof typeof entitlements];
          const bytes = encoded ? fromBase64(encoded) : undefined;
          const dict = bytes ? parsePlist(bytes) : undefined;
          return {
            signing: {
              kind: "identity",
              identity: { certificate: identity.certificate, chain: [], privateKey: identity.privateKey },
              teamId: TEAM,
            },
            ...(bytes && dict && isPlistDict(dict) ? { entitlements: { bytes, dict } } : {}),
          };
        },
      },
      { hasher, logger: silentLogger, clock: fixedClock(new Date(SIGNING_TIME)) },
    );

    console.info(
      `[parity] ${browserResult.userAgent.match(/(Headless)?Chrome\/[\d.]+/)?.[0]} signed in ${browserResult.ms.toFixed(0)} ms (${browserResult.hasher})`,
    );
    const fromBrowser = new Map(browserResult.files.map((f) => [f.path, toHex(fromBase64(f.data))]));
    expect([...fromBrowser.keys()].sort()).toEqual([...tree.keys()].sort());
    for (const [path, entry] of tree) {
      const nodeHex = toHex(entry.kind === "file" ? entry.data : new TextEncoder().encode(entry.target));
      expect({ path, hex: fromBrowser.get(path) }).toEqual({ path, hex: nodeHex });
    }
    expect(browserResult.hasher).toBe("webcrypto");
  }, 120_000);
});
