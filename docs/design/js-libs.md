# Pure-TS iOS re-signer: library research

Date: 2026-10-13. Versions, licenses and publish dates were read from registry.npmjs.org and api.github.com on that date.
Every "verified" claim was run in throwaway benchmarks on Node 22.22.3 and HeadlessChrome 155 (puppeteer-core), on an Apple M4 Pro.

## 0. Summary of recommendations

| Concern | Pick | Version / license | Why |
|---|---|---|---|
| CMS SignedData (detached, custom Apple attrs) | **pkijs + asn1js** | 3.4.1 / 3.0.10, BSD-3-Clause | Verified: it accepts arbitrary OIDs (100.9.1 plist, 100.9.2 CDHashes2). OpenSSL `cms -verify` accepts the detached result. Parse→re-encode is byte-identical. Uses native WebCrypto in Node and the browser with no polyfill. |
| RSA signing | **WebCrypto** `RSASSA-PKCS1-v1_5`/SHA-256, key imported as PKCS#8 | built in | Async, but signing happens only once per Mach-O slice, so async cost is irrelevant. Native speed. |
| PKCS#12 import/export | **node-forge** (p12 only, and the CSR fallback) | 1.4.0, BSD-3-Clause OR GPL-2.0 | Verified: pkijs **fails** on legacy p12 (3DES, RC2-40). Those are what macOS Keychain and `openssl -legacy` produce, because WebCrypto has no 3DES or RC2. forge reads modern AES/PBES2, 3DES and RC2 files, and writes 3DES/SHA1-MAC p12 files that Keychain and iOS import. |
| Keygen + CSR | WebCrypto `generateKey` + **pkijs `CertificationRequest`** | — | @peculiar/x509 2.1.0 needs a `reflect-metadata` polyfill (tsyringe throws without it), so avoid it. |
| Page hashing (SHA-1/SHA-256) | **WebCrypto `subtle.digest`** for bulk work, with **@noble/hashes** (2.4.0, MIT) as the sync fallback | — | Per-page WebCrypto ran at 1.6 GB/s in Chrome and about 1.1 GB/s batched in Node, which beats WASM and pure JS. hash-wasm (4.12.0, MIT) has not been published since 2024-11. |
| ZIP | **@zip.js/zip.js** | 2.23.0, BSD-3-Clause | Verified: it reads and writes the symlink flag, `unixMode`, the exec bit, Zip64, and Blob/stream I/O. A 200 MB IPA was rewritten in a stream in 550 ms with 126 MB peak RSS. fflate cannot *read* external attributes. |
| Plist (XML + binary) | **@plist/\*** (xml.parse/xml.serialize/binary.parse/binary.serialize) | 1.1.x, BSD-3-Clause-Clear | Pure TS, works in browser and Node, BigInt-safe. Caveat: it loses the real-vs-integer distinction (so does `plist`). |
| DER entitlements | **Hand-roll on asn1js** (~30 LOC) | — | Verified **byte-identical** to `codesign --generate-entitlement-der` on a non-trivial dict. |
| Reference implementations | zsign (C++, MIT), zsign-rs (Rust, MIT), apple-codesign/rcodesign (Rust, MPL-2.0) | — | No pure-JS signer exists. |

## 1. Prior art

| Project | What it is | Signs in pure JS? | Status / license | Use as reference? |
|---|---|---|---|---|
| `applesign` (nowsecure/node-applesign) npm 5.0.1, 2025-05-14 | Node CLI/API for IPA re-signing | **No.** `lib/tools.js` spawns `/usr/bin/codesign` (or `ldid2`) plus `security`, so it runs on macOS only | MIT, 488 stars, pushed 2026-07 | Its IPA workflow logic (entitlements merge, provisioning, ordering of nested bundles) is useful. Its signing code is not. |
| `ipa-resign` npm 0.0.17, 2026-10-08 (650 Industries / Expo) | Full free-Apple-ID flow (GSA auth, anisette, cert/profile, sign) | **No.** It bundles `bin/zsign` (native) and `assets/zsign/zsign-wasm.min.js` (zsign compiled to WASM with Emscripten and OpenSSL). Deps include node-forge, fflate, yauzl/yazl, plist, bplist-parser | **PROPRIETARY license that forbids use and reverse engineering.** Do not use or read its code. | Only as evidence that the product shape is viable (Expo ships a web plus Node version). |
| `zsign` (zhlynn/zsign) | C++ cross-platform signer on OpenSSL | n/a (native) | MIT, 1.9k stars, pushed 2026-08 | **Best behavioural reference** (CodeDirectory layout, CodeResources, CMS attrs, nested bundles). MIT, so porting its logic is fine. |
| `zsign-wasm` (npm 0.0.4, gabrieldonadel), `@lynfe/zsign-wasm-resigner-wrapper` 0.2.0, `@lbr77/...` 0.1.5 | zsign + OpenSSL compiled with Emscripten (about 6–10 MB unpacked), jszip for IPA | No, it is WASM C++ | MIT, 0 stars, forks with low activity | Could serve as a differential test oracle. Not a dependency. |
| `@jveko/zsign-wasm` 0.1.1 (jveko/zsign-rs) | Pure-Rust zsign port (RustCrypto `cms`, `rsa`, `x509-cert`) built to WASM, 1.2 MB | No, it is Rust/WASM | MIT (Cargo), 4 stars, pushed 2026-10-03 | Good, readable reference for the CMS and CodeDirectory structure. Also a candidate test oracle. |
| `apple-codesign` / rcodesign (indygreg/apple-platform-rs) | Most complete open-source re-implementation of Apple code signing | Rust | MPL-2.0, 867 stars, active | **Authoritative reference.** `plist_der.rs` documents the DER entitlements format. MPL-2.0 is file-level copyleft, so port ideas rather than copy files. |
| `ldid` (ProcursusTeam) and `ldid-wasm` (JiJingren) | Saurik's signer and its WASM port | No | **AGPL-3.0**, so avoid copying code | Reference only. |
| `isign` (sauce-archives) | Python signer | No | Archived 2020. GitHub reports NOASSERTION | Outdated (no DER entitlements, no CDHashes2). |
| `macho-unsign` 2.0.6 (MPL-2.0), `macho` 1.5.0 (MIT, 2023), `macho-entitlements` | Mach-O parsing and signature removal in JS | Parsing only | small | Fat/thin parsing references. Writing our own parser is simpler. |
| `kubkon/zignature` (Zig, MIT) | Toy signer | — | 2022 | — |

**Conclusion:** nobody publishes an open-source, pure JS/TS Mach-O signer on npm. Every working option shells out to `codesign` or `ldid`, or embeds zsign through WASM. We have to write the Mach-O, CodeDirectory, SuperBlob and CodeResources code ourselves. That part is relatively small: rcodesign and zsign-rs both show it is a few thousand lines.

## 2. CMS / PKCS#7 SignedData

Requirements: a detached CodeDirectory with signedAttrs = contentType, signingTime, messageDigest, `1.2.840.113635.100.9.1` (OCTET STRING containing a plist of truncated cdhashes), and `1.2.840.113635.100.9.2` (SET of `SEQUENCE{hashAlgOID, OCTET STRING}`). The signature is RSA PKCS#1 v1.5 with SHA-256. The certs field carries leaf + WWDR + Apple Root.

| | pkijs 3.4.1 (+asn1js) | node-forge 1.4.0 | @peculiar/asn1-cms 2.11.0 (+asn1-schema) |
|---|---|---|---|
| License | BSD-3-Clause | BSD-3 OR GPL-2 | MIT |
| Last publish | 2026-09-20 | 2026-03-24 | 2026-10-12 |
| Custom signed attrs with arbitrary OIDs | **Yes**, `new Attribute({type, values:[asn1js...]})`. **Verified.** | **No.** `_attributeToAsn1` only handles contentType, messageDigest and signingTime ("TODO: generalize"). Any other attribute would need monkey-patching. | Yes (schema-level), but you assemble and sign by hand |
| Detached content | Yes (no `eContent`, `sign(key, 0, 'SHA-256', data)`) | Yes (`detached` option) | Manual |
| Signing engine | WebCrypto (async), any `crypto` object passed to `setEngine` | Own pure-JS RSA, sync (~10 ms/sign in Chrome) | You call WebCrypto yourself |
| Browser + Node with no polyfills | **Yes**, uses `globalThis.crypto` (Node ≥19 / Electron) | Yes | Yes. **@peculiar/x509** on top needs `reflect-metadata`. |
| DER exactness | Re-encoding a parsed message gave byte-identical output (verified). signedAttrs are encoded in insertion order. pkijs does not sort SET OF, but verifiers hash the bytes as emitted, so validation is unaffected | Uses its own ASN.1. History of ASN.1 bugs (CVE-2025-12816, fixed 1.3.2; several fixed in 1.4.0) | Good |
| Bundle (min / gzip, esbuild) | 391 KB / 82 KB (asn1js alone 60/15) | 287/76 full, 216/55 for p12+pkcs7+x509 | 128/32 |

**Verified** (`bench/cms.mjs`): pkijs built SignedData with all five attributes on a 2048-bit WebCrypto key, signed in about 1 ms, produced 1848 bytes, verified true in pkijs, and passed `openssl cms -verify -binary -content cd.bin -noverify` (OpenSSL 4.0.3). `openssl cms -print` shows the 100.9.2 structure exactly as specified.

**Recommendation: pkijs.** Async signing is fine because each Mach-O slice gets exactly one CMS signature.

## 3. Keys, CSR, PKCS#12

- **Keygen:** WebCrypto `generateKey(RSASSA-PKCS1-v1_5, 2048, extractable)` took about 21 ms in Node and is natively fast in Chrome. forge's pure-JS keygen took **337 ms** in a Chrome Worker. In Node it took 14 ms because forge delegates to node:crypto there, so Node numbers for forge keygen are misleading.
- **CSR:** use pkijs `CertificationRequest`, or forge `pki.createCertificationRequest` as a sync fallback. @peculiar/x509 `Pkcs10CertificateRequestGenerator` worked (`openssl req -verify` OK) but only after `import "reflect-metadata"`, so avoid it to stay polyfill-free.
- **PKCS#12 (verified, `bench/p12.mjs`):**

| p12 variant | forge | pkijs |
|---|---|---|
| OpenSSL 3 default (PBES2/AES-256/PBKDF2-SHA256, MAC SHA-256) | OK | OK |
| `-legacy` (RC2-40 cert bag + 3DES key, MAC SHA-1). This is the classic Keychain/Xcode export | OK | **FAIL** `Unknown contentEncryptionAlgorithm 1.2.840.113549.1.12.1.6` |
| 3DES for both, MAC SHA-1 | OK | **FAIL** `...12.1.3` |

  For export, use forge `toPkcs12Asn1(key,[cert],pw,{algorithm:'3des'})`. It took 9 ms, OpenSSL reads it, and its legacy encryption imports everywhere: older macOS `security import` and iOS reject AES/SHA-256-MAC p12 files. After import, convert forge's key to PKCS#8 DER and pass it to `crypto.subtle.importKey('pkcs8', ..., {name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'}, false, ['sign'])` (verified round-trip in a Worker).
- Optionally write a ~150-LOC 3DES/RC2 PBE module on pkijs instead of using forge. Using forge only for p12 is pragmatic, but pin ≥1.4.0 because of the recent CVE stream.

## 4. Hashing benchmark (100 MiB, 25,600 × 4 KiB pages)

`bench/bench.mjs` (Node 22) and `bench/bbench.mjs` (HeadlessChrome 155, main thread):

| Method | Node SHA-1 | Node SHA-256 | Chrome SHA-1 | Chrome SHA-256 |
|---|---|---|---|---|
| node:crypto createHash per page | 2118 MB/s | 2520 MB/s | — | — |
| WebCrypto per page, sequential `await` | 365 | 396 | **1656** | **1639** |
| WebCrypto per page, `Promise.all` batches of 256 | 1167 | 1076 | 1468 | 1608 |
| WebCrypto single 100 MB digest | 2289 | 2846 | 2137 | 2415 |
| hash-wasm (reused hasher, init/update/digest) | 919 | 529 | 792 | 448 |
| @noble/hashes 2.4.0 (sync) | 366 | 290 | 112 | 80 |

Takeaways:
- Per-call promise overhead is real in Node (sequential awaits run 5x slower than createHash). Batching pages with `Promise.all` recovers most of it. In Chrome, per-page WebCrypto is already fast.
- A 300 MB binary takes about 0.2–0.3 s with WebCrypto in either runtime, versus about 1–4 s with noble in Chrome.
- **Design:** a `Hasher` interface `hashPages(alg, buf, pageSize): Promise<Uint8Array[]>` that batches 256 pages per `Promise.all`. In Node/Electron it can use `node:crypto` directly as an optional fast path. Keep noble (6 KB min) for small sync hashes, such as CodeResources files that are already in memory, and as a fallback. hash-wasm adds nothing worth its cost and has not been published since 2024-11-19.
- WebCrypto `digest` supports SHA-1 in all browsers and in Workers. It requires a secure context (https or localhost).

## 5. ZIP

| | @zip.js/zip.js 2.23.0 | fflate 0.8.3 | jszip 3.10.2 | yauzl/yazl |
|---|---|---|---|---|
| License | BSD-3-Clause | MIT | MIT OR GPL-3 | MIT |
| Browser + Node | Yes (Web Streams, Blob, `fs.openAsBlob`) | Yes | Yes | Node only |
| Read external attrs / symlink / exec | **Yes**: `entry.symlink`, `executable`, `unixMode`, `externalFileAttributes` (verified) | **No**: `Unzip` file object exposes only name/compression/size/originalSize (verified). The central directory would need custom parsing | `unixPermissions` yes | yes |
| Write unix mode / symlink | **Yes**: `unixMode: 0o120777` for symlinks, `versionMadeBy` (verified; `unzip` recreated the symlink and the 0755 exec bit) | Yes: `{os:3, attrs: mode<<16}` (verified with zipinfo `lrwxrwxrwx`) | yes | yes |
| Zip64 | Read and write | Partial read, no write | Partial | yes |
| Streaming large files | Yes: random-access BlobReader, WritableStream output | Streaming, but the API is chunk-push | No (all in memory) | yes |
| Bundle min/gz | 167 / 71 KB | 17 / 7 KB | ~95 / 28 KB | n/a |

**Verified** (`bench/zj.mjs`, `bench/zbig.mjs`): an IPA round-trip with a framework symlink and an exec binary kept `lrwxr-xr-x` and `-rwxr-xr-x`. A streamed 200 MB IPA rewrite (BlobReader → TransformStream → ZipWriter → fs WritableStream) took 550 ms with **126 MB peak RSS** and `unzip -t` OK.

**Pick zip.js.** Set `configure({useWebWorkers:false})` when already inside our own Worker. It uses native `CompressionStream` where available. Store `_CodeSignature`/Mach-O entries as needed; `level` can be set per entry.

## 6. Plist

| Lib | Formats | Browser | Notes |
|---|---|---|---|
| **@plist/\*** (mat-sz) xml.parse 1.1.0, xml.serialize 1.1.1 (2024-12), binary.parse/serialize 1.1.0 | XML, binary, OpenStep | Yes, pure TS. xml.parse uses fast-xml-parser, not DOM | BSD-3-Clause-Clear. Verified: parses Apple binary plist, handles BigInt above 2^53, binary output passes `plutil -lint`. **Loses real vs integer** (`<real>2</real>` → `<integer>2</integer>`). Low maintenance cadence. |
| `plist` 5.0.0 (2026-05) | XML only | Yes (`@xmldom/xmldom`, xmlbuilder) | MIT. Named exports only in v5 (no default). Loses big-int precision (9007199254740993 → ...992). |
| `@expo/plist` 0.8.1 | XML only | Yes | MIT |
| `bplist-parser` 0.5.0 / `bplist-creator` 0.3.0 | binary | **No**: uses Node `Buffer`, and creator uses `stream-buffers` | MIT |

**Recommendation:** use @plist/* now, behind our own `Plist` facade. Long term, consider a small typed codec (~500 LOC) that keeps `{type:'real'}` tags, so that rewriting Info.plist never changes types. For re-signing we mostly *read* Info.plist and the profile, and write only CodeResources (XML), the entitlements XML and, optionally, a modified Info.plist. Provisioning profiles: strip the CMS wrapper with pkijs `ContentInfo`/`SignedData` → `encapContentInfo.eContent`, then parse the XML.

## 7. DER entitlements

No JS library implements it. The format (from apple-codesign `plist_der.rs`, confirmed by test):
`[APPLICATION 16] { INTEGER 1, value }`. A dict is `[CONTEXT 16] constructed { SEQUENCE { UTF8String key, value } ... }`, **sorted by key bytes**. An array is `SEQUENCE`. Booleans, integers and strings use their universal DER types. data, real and date are not allowed and must be rejected.

**Verified** (`bench/der.mjs`): a ~30-line asn1js encoder produced output **byte-identical** (321 bytes) to `codesign -s - --generate-entitlement-der` on a dict with nested dicts, arrays, negative and multi-byte ints, bools and unsorted keys. Wrap it in blob magic `0xfade7172` in code-signature slot 7 (special slot -7 in the CodeDirectory).

## 8. Browser constraints

Measured in HeadlessChrome 155 on macOS with 16 GB RAM (`bench/mem-page.mjs`, `mem2.js`):
- A single `ArrayBuffer`: 1 GiB **ok**, ≥2047 MiB **fails** (`RangeError: Array buffer allocation failed`). Total: twenty 500 MB buffers (10 GB) succeeded, because buffers live outside the JS heap (`jsHeapSizeLimit` was 4192 MB). Holding three 300 MB copies at once worked. Low-RAM devices and Chromebooks will OOM sooner, so stream ZIP entries from a `File`/Blob (zip.js BlobReader is random access) and keep only the Mach-O being signed in memory. Write output to OPFS or `showSaveFilePicker` (both available) instead of a giant Blob.
- **Worker** (verified in a dedicated Worker): `crypto.subtle` (keygen, pkcs8 export, sign), pkijs, forge, zip.js, @plist, hash-wasm all ran. `navigator.usb` exists in a Worker in Chrome. Run the whole pipeline in a Worker so the UI stays responsive.
- **WebUSB:** Chromium only (no Firefox, no Safari). It needs a secure context and a user gesture for `requestDevice`. **Risk:** on macOS the system usbmuxd claims the iPhone's interface, and on Windows the Apple Mobile Device driver does (Windows forbids a second handle). WebUSB `claimInterface` is therefore expected to fail unless the driver is swapped to WinUSB (Zadig) or usbmuxd is stopped. Linux needs udev rules. Prior art: `hack-different/webmuxd` (usbmuxd over WebUSB). Plan on the desktop/Electron path for installation, and treat WebUSB install as best-effort. This was not tested with a physical device.
- WebCrypto requires `https` or `localhost`. Electron renderer: use the Node path, or the same Web path in a Worker.

## 9. Top risks

1. **No pure-JS reference signer exists.** CodeDirectory, CodeResources and nested-bundle correctness must be built and tested against `codesign -v` on macOS CI and against zsign or rcodesign as oracles. Expect edge cases: fat binaries, `__LINKEDIT` resizing, special slots, the exec-segment field, the hardened runtime flags.
2. **PKCS#12 legacy crypto.** pkijs can't decrypt common p12 files, so we depend on node-forge, which has had a recent CVE stream (CVE-2025-12816; 1.4.0 fixes). Pin it and use it only for p12 and the CSR fallback.
3. **Licensing contamination.** `ipa-resign` is proprietary (do not read it). ldid is AGPL. rcodesign is MPL-2.0 (port ideas, not files). zsign and zsign-rs are MIT and safe to port.
4. **Plist type fidelity** (real vs integer, big ints) when re-serializing Info.plist.
5. **Browser memory and WebUSB driver conflicts.** WebCrypto per-call overhead in Node has to be handled by batching.
6. Package footprint: pkijs (82 KB gz) + forge subset (55 KB) + zip.js (71 KB) is about 210 KB gz, which is acceptable.

## Sources
- npm registry metadata (registry.npmjs.org/<pkg>), GitHub REST API repo metadata
- [apple-codesign plist_der.rs](https://github.com/indygreg/apple-platform-rs/blob/main/apple-codesign/src/plist_der.rs)
- [zhlynn/zsign](https://github.com/zhlynn/zsign), [jveko/zsign-rs](https://github.com/jveko/zsign-rs)
- [node-forge CVE-2025-12816 / CERT VU#521113](https://kb.cert.org/vuls/id/521113), [stack.watch forge CVEs](https://stack.watch/product/digitalbazaar/forge/)
- [hack-different/webmuxd](https://github.com/hack-different/webmuxd), [MDN claimInterface](https://developer.mozilla.org/en-US/docs/Web/API/USBDevice/claimInterface), [Chromium WebUSB interface class filtering](https://groups.google.com/a/chromium.org/g/blink-dev/c/LZXocaeCwDw/m/GLfAffGLAAAJ)
- [Apple sigblob.h](https://opensource.apple.com/source/Security/Security-59754.140.13/OSX/libsecurity_codesigning/lib/sigblob.h.auto.html)
