[← Architecture](architecture.md) · [Back to README](../README.md) · [Roadmap →](roadmap.md)

# Code Signing

An iPhone only runs code that carries a valid signature from a certificate Apple trusts, tied to a provisioning profile that lists the device. `@loadstar/signer` re-signs apps with **your** free development certificate. It is pure TypeScript and runs unchanged in Node, Electron and browser Web Workers. The byte-level reference is `docs/design/signer-spec.md`.

## How it works

```
 .ipa ──read (streamed, zip-slip safe)──▶ app tree
        └─ reconcile for sideloading: new bundle IDs, Info.plist keys, per-bundle profile + entitlements
        └─ sign bottom-up, for each nested framework / plug-in / loose dylib, then the app:
              embedded.mobileprovision → _CodeSignature/CodeResources (seal every file)
              → per Mach-O slice: patch LC_CODE_SIGNATURE + __LINKEDIT (codesign_allocate rules)
                → CodeDirectory (SHA-256, or SHA-1 + SHA-256 below iOS 11; 4 KB or 16 KB pages)
                → requirements + entitlements (XML + DER) → CMS (Apple cdhash attributes, WWDR chain)
                → SuperBlob; fat binaries reassembled
 app tree ──write (streamed, modes + symlinks kept)──▶ signed .ipa
```

## Using it

```ts
import { bytesFileSource } from "@loadstar/kernel";
import { resolveChain, signIpa } from "@loadstar/signer";

// Bundled Apple intermediates first; unknown ones are downloaded from the certificate's issuer
// link and accepted only if they verifiably chain to a pinned Apple root.
const { chain } = await resolveChain(certificate, { fetchIssuer: (url) => http.getBytes(url) });

const { ipa, summary } = await signIpa(bytesFileSource("SideStore.ipa", ipaBytes), {
  signing: {
    kind: "identity",
    identity: { certificate, chain, privateKey }, // privateKey: CryptoKey
    teamId: "ABCDE12345",
  },
  sideload: {
    teamId: "ABCDE12345",
    newMainBundleId: "com.SideStore.SideStore.ABCDE12345",
    certificate,
    profiles, // Map<new bundle ID, raw provisioning profile>
    deviceUdid,
    pruneUnprovisioned: true, // drop extensions the account could not provision
  },
  onProgress: (event) => console.log(event.stage),
  signal, // AbortSignal
});
// `ipa` is a ReadableStream<Uint8Array>; `summary.bundles` lists every signed bundle and its cdhash.
```

### Tuning

Nothing in the engine is hard-coded beyond what the file formats themselves fix. Every tunable has a
default that matches Apple `codesign` and can be overridden per call:

```ts
await signIpa(source, {
  signing,
  // Page size, hash algorithms and CMS reservation. "codesign" follows Apple's own choice.
  policy: { pageSize: "codesign", hashAlgorithms: "codesign", cmsReservation: 18_000 },
  // Hostile-input limits; override any subset.
  limits: {
    plist: { maxDepth: 64, maxExpandedNodes: 1_000_000, maxExpandedBytes: 64 * 1024 * 1024 },
    machO: { maxFatArches: 16 },
    ipa: { maxEntries: 200_000, maxUncompressedBytes: 4 * 1024 ** 3 },
  },
  // Output archive: compression level 0–9 (0 = store), plus the stored-extension pattern,
  // the members dropped on read and the entry timestamp.
  archive: { compressionLevel: 0 },
});
```

The defaults are exported as `DEFAULT_SIGNING_POLICY`, `DEFAULT_SIGNER_LIMITS`, `DEFAULT_DROPPED_MEMBERS`,
`DEFAULT_STORED_EXTENSIONS` and `DEFAULT_ENTRY_DATE`. `signBundle` and `signBinary` take the same `policy`
and `limits`. `createHasher({ batchSize })` controls how many pages WebCrypto hashes concurrently.

Format constants are not options: blob magics, slot numbers and flags are in `domain/blobs/constants.ts`,
OIDs are in `infrastructure/cms/oids.ts`, and bundle paths and file modes are in `domain/bundle/layout.ts`.

Lower-level building blocks are also exported: `signBundle`, `signBinary`, `reconcileForSideload`, `readIpa`/`writeIpa`, `parseProvisioningProfile`, and the plist API (`parsePlist`, `serializeXmlPlist`).

## How we know it's right

| Evidence | Where |
|---|---|
| Every signature blob (CodeDirectory incl. SHA-1 dual and 16 KB pages, requirements, entitlements, wrapper) of 10 signed executables is **byte-identical to Apple `codesign`** | `domain/blobs/blobs.test.ts` |
| Mach-O allocation (`LC_CODE_SIGNATURE`, `__LINKEDIT`, reservation size) identical to `codesign_allocate`, including re-signing and fat binaries | `domain/macho/allocate.test.ts` |
| `CodeResources` identical for the app, framework and plug-in | `domain/code-resources/code-resources.test.ts` |
| A whole `.app` signed ad-hoc is **file-for-file identical** to Apple's | `application/sign-bundle.test.ts` |
| Certificate-signed binaries, bundles, sideload-reconciled apps and written IPAs pass `codesign --verify --deep --strict` | macOS tests |
| CMS verifies with pkijs and `openssl cms` | `infrastructure/cms/cms.test.ts` |
| Plist writer matches `plutil` byte for byte (including `%.17g` reals) | `domain/plist/plist.test.ts` |
| A Chromium Web Worker produces byte-identical output to Node | `test/browser-parity.test.ts` |
| Real SideStore 0.7.0-alpha is sideload-signed in ~0.5 s and verifies | `application/sign-ipa.test.ts` (`LOADSTAR_E2E=1`) |

The golden inputs and Apple outputs live in `fixtures/signer/` ([README](../fixtures/signer/README.md)). Regenerate them on macOS with `fixtures/signer/generate.sh`; `--check` fails when an Xcode update changes Apple's behaviour. Checking the CMS against a **real** Apple Development certificate is a one-command maintainer step: [`fixtures/signer/REAL-CERT.md`](../fixtures/signer/REAL-CERT.md).

## Rules worth knowing

| Rule | Why |
|---|---|
| Sign innermost bundles first, and write profiles before sealing | A parent's `CodeResources` hashes its children's *final* bytes |
| Each extension gets its own profile and entitlements | Otherwise installd reports "invalid entitlements" or "no valid provisioning profile" |
| Extension IDs must start with the app's ID | installd rejects them otherwise (`signer.extension_prefix`) |
| Team ID is written into every binary | Mixed or missing team IDs crash the app at launch |
| Encrypted (App Store) binaries are refused | FairPlay-encrypted apps cannot be re-signed; you need a decrypted IPA |
| 16 KB code pages for iOS 16+, SHA-1 + SHA-256 below iOS 11 | Matches Apple `codesign` 26 |

## Error codes

| Code | Meaning |
|---|---|
| `signer.invalid_macho` / `signer.unsupported_arch` | Not a usable Mach-O binary |
| `signer.encrypted_binary` | App Store build; needs a decrypted IPA |
| `signer.no_header_space` | Binary has no room for a signature load command |
| `signer.zip_slip` / `signer.invalid_bundle` | Unsafe or malformed archive, missing `Payload/*.app`, size limits |
| `signer.invalid_plist` / `signer.invalid_certificate` / `signer.invalid_profile` | Malformed inputs |
| `signer.unknown_issuer` | The certificate's issuer is neither bundled nor downloadable and verifiable to an Apple root |
| `signer.extension_prefix` | Extension ID not under the app's ID |
| `signer.profile_mismatch` / `signer.profile_expired` / `signer.cert_not_in_profile` / `signer.device_not_provisioned` | Profile doesn't fit this app, certificate or device |

## See Also

- [Architecture](architecture.md): where the signer sits
- [Contributing](contributing.md): fixtures, tests and conventions
