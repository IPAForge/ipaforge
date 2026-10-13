/**
 * Maintainer tool (macOS): compare Loadstar's signature with Apple codesign's for a REAL Apple
 * Development certificate. See fixtures/signer/REAL-CERT.md.
 *
 *   pnpm --filter @loadstar/signer compare-real-cert -- --p12 identity.p12 [--password …]   (or LOADSTAR_P12_PASSWORD)
 *
 * The .p12 is imported into a temporary keychain that is deleted afterwards; nothing is written
 * to your login keychain. The private key is passed to Loadstar in memory only.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fromBase64, silentLogger, systemClock, toHex } from "@loadstar/kernel";
import { readTree } from "@signer/__tests__/fixtures.ts";
import { CSSLOT_SIGNATURESLOT, parseSuperBlob } from "@signer/domain/blobs/index.ts";
import type { BundleTree } from "@signer/domain/bundle/tree.ts";
import { parseMachO } from "@signer/domain/macho/parse.ts";
import { certificateInfo, createHasher, isPlistDict, parsePlist, resolveChain, signBundle } from "@signer/index.ts";

const FIXTURES = join(import.meta.dirname, "../../../fixtures/signer");
const arg = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const run = (cmd: string, args: readonly string[], input?: string): string =>
  execFileSync(cmd, args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...(input ? { input } : {}) });
const pemBody = (pem: string, label: string): Uint8Array =>
  fromBase64(pem.match(new RegExp(`-----BEGIN ${label}-----([\\s\\S]+?)-----END ${label}-----`))?.[1] ?? "");

const p12 = arg("--p12");
const password = arg("--password") ?? process.env.LOADSTAR_P12_PASSWORD ?? "";
if (!p12) {
  console.error("usage: compare-real-cert.ts --p12 <file> [--password <pw>]");
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), "loadstar-realcert-"));
const keychain = join(work, "compare.keychain-db");
const report: string[] = [];
let failures = 0;
const check = (label: string, ok: boolean, detail = ""): void => {
  report.push(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
};

try {
  // 1. certificate + key out of the .p12 (in memory / temp dir only)
  const certPem = run("openssl", [
    "pkcs12",
    "-in",
    p12,
    "-nokeys",
    "-clcerts",
    "-passin",
    `pass:${password}`,
    "-legacy",
  ]);
  const keyPem = run("openssl", ["pkcs12", "-in", p12, "-nocerts", "-nodes", "-passin", `pass:${password}`, "-legacy"]);
  const pkcs8Pem = run("openssl", ["pkcs8", "-topk8", "-nocrypt"], keyPem);
  const certificate = pemBody(certPem, "CERTIFICATE");
  const info = certificateInfo(certificate);
  const teamId = info.organizationalUnit ?? "";
  // bundled Apple intermediates first, then the certificate's own issuer link (verified to an Apple root)
  const resolution = await resolveChain(certificate, {
    fetchIssuer: async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer()),
  });
  const chain = [...resolution.chain];
  report.push(
    `certificate: ${info.commonName} (team ${teamId}), chain: ${chain.length} certs (${resolution.source}${resolution.fetchedFrom ? ` from ${resolution.fetchedFrom}` : ""})`,
  );

  // 2. temporary keychain with the identity, for codesign
  run("security", ["create-keychain", "-p", "loadstar", keychain]);
  run("security", ["unlock-keychain", "-p", "loadstar", keychain]);
  run("security", ["import", p12, "-k", keychain, "-P", password, "-T", "/usr/bin/codesign"]);
  run("security", ["set-key-partition-list", "-S", "apple-tool:,apple:", "-s", "-k", "loadstar", keychain]);
  const identityHash = run("security", ["find-identity", "-v", "-p", "codesigning", keychain]).match(
    /\b([0-9A-F]{40})\b/,
  )?.[1];
  if (!identityHash)
    throw new Error("codesign identity not found in the temporary keychain (is the certificate valid and trusted?)");

  // 3. Apple codesign, bottom-up, same inputs as the ad-hoc fixtures
  const appleApp = join(work, "apple/Test.app");
  cpSync(join(FIXTURES, "inputs/Test.app"), appleApp, { recursive: true, verbatimSymlinks: true });
  const sign = (path: string, entitlements?: string, identifier?: string): void => {
    const args = ["-f", "-s", identityHash, "--keychain", keychain, "--timestamp=none", "--generate-entitlement-der"];
    if (identifier) args.push("-i", identifier);
    if (entitlements) args.push("--entitlements", join(FIXTURES, entitlements));
    run("codesign", [...args, path]);
  };
  sign(join(appleApp, "Frameworks/Lib.framework"));
  sign(join(appleApp, "Frameworks/libloose.dylib"), undefined, "libloose");
  sign(join(appleApp, "PlugIns/Ext.appex"), "entitlements/appex.plist");
  sign(appleApp, "entitlements/app.plist");

  // 4. Loadstar, same certificate/key
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemBody(pkcs8Pem, "PRIVATE KEY") as Uint8Array<ArrayBuffer>,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const tree: BundleTree = new Map(
    readTree(join(FIXTURES, "inputs/Test.app")).map((e) => [
      e.path,
      e.kind === "symlink"
        ? { kind: "symlink" as const, target: e.target ?? "", mode: e.mode }
        : { kind: "file" as const, data: e.data ?? new Uint8Array(), mode: e.mode },
    ]),
  );
  const entitlementsFor = (kind: string) => {
    const file = kind === "app" ? "entitlements/app.plist" : kind === "appex" ? "entitlements/appex.plist" : undefined;
    if (!file) return undefined;
    const bytes = new Uint8Array(readFileSync(join(FIXTURES, file)));
    const dict = parsePlist(bytes);
    return isPlistDict(dict) ? { bytes, dict } : undefined;
  };
  await signBundle(
    tree,
    {
      configFor: (bundle) => {
        const entitlements = entitlementsFor(bundle.kind);
        return {
          signing: { kind: "identity", identity: { certificate, chain, privateKey }, teamId },
          ...(entitlements ? { entitlements } : {}),
        };
      },
    },
    { hasher: createHasher(), logger: silentLogger, clock: systemClock },
  );

  // 5. compare every executable: all blobs byte-for-byte except the CMS, CMS structurally
  for (const path of ["Test", "PlugIns/Ext.appex/Ext", "Frameworks/Lib.framework/Lib", "Frameworks/libloose.dylib"]) {
    const ours = (tree.get(path) as { data: Uint8Array }).data;
    const apple = new Uint8Array(readFileSync(join(appleApp, path)));
    const blobsOf = (bytes: Uint8Array) => {
      const slice = parseMachO(bytes).slices[0];
      const sig = slice?.codeSignature;
      if (!slice || !sig) throw new Error(`${path} unsigned`);
      return { slice, blobs: parseSuperBlob(slice.bytes.subarray(sig.dataoff, sig.dataoff + sig.datasize)) };
    };
    const a = blobsOf(apple);
    const o = blobsOf(ours);
    check(`${path}: same slot layout`, a.blobs.map((b) => b.slot).join() === o.blobs.map((b) => b.slot).join());
    for (const blob of a.blobs.filter((b) => b.slot !== CSSLOT_SIGNATURESLOT)) {
      const mine = o.blobs.find((b) => b.slot === blob.slot);
      check(`${path}: slot 0x${blob.slot.toString(16)} identical`, !!mine && toHex(mine.blob) === toHex(blob.blob));
    }
    const cmsText = (blobs: typeof a.blobs, name: string): string => {
      const cms = blobs.find((b) => b.slot === CSSLOT_SIGNATURESLOT)?.blob.subarray(8) ?? new Uint8Array();
      const file = join(work, `${name}.cms`);
      writeFileSync(file, cms);
      return run("openssl", ["cms", "-cmsout", "-print", "-inform", "DER", "-in", file])
        .replace(/UTCTIME:.*|GENERALIZEDTIME:.*/g, "<time>")
        .replace(/signature:[\s\S]*?(?=\n\s{4,6}\w|\n\s*unsignedAttrs)/g, "signature: <sig>");
    };
    const appleCms = cmsText(a.blobs, `apple-${path.replaceAll("/", "_")}`);
    const ourCms = cmsText(o.blobs, `ours-${path.replaceAll("/", "_")}`);
    check(`${path}: CMS structure identical (time/signature masked)`, appleCms === ourCms);
    if (appleCms !== ourCms) {
      writeFileSync(join(work, `${path.replaceAll("/", "_")}.apple.txt`), appleCms);
      writeFileSync(join(work, `${path.replaceAll("/", "_")}.ours.txt`), ourCms);
    }
  }

  // 6. Apple accepts ours
  const oursApp = join(work, "ours/Test.app");
  cpSync(join(FIXTURES, "inputs/Test.app"), oursApp, { recursive: true, verbatimSymlinks: true });
  for (const [path, entry] of tree) if (entry.kind === "file") writeFileSync(join(oursApp, path), entry.data);
  const verify = spawnSync("codesign", ["--verify", "--deep", "--strict", "-vv", oursApp], { encoding: "utf8" });
  check(
    "codesign --verify --deep --strict on Loadstar's output",
    verify.status === 0,
    verify.stderr.trim().split("\n").at(-1),
  );
} catch (error) {
  failures++;
  report.push(`✗ ${(error as Error).message}`);
} finally {
  spawnSync("security", ["delete-keychain", keychain]);
}

console.log(report.join("\n"));
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed. Artefacts kept in ${work}`);
if (failures === 0) rmSync(work, { recursive: true, force: true });
process.exitCode = failures === 0 ? 0 : 1;
