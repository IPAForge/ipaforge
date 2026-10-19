[← Architecture](architecture.md) · [Back to README](../README.md) · [Device →](device.md)

# Code Signing

An iPhone only runs code that carries a valid signature from a certificate Apple trusts, tied to a provisioning profile that lists the device. `@ipaforge/signer` re-signs apps with **your** free development certificate. It is pure TypeScript and runs in Node and Electron. The byte-level reference is `docs/design/signer-spec.md`.

## How it works

```
 .ipa ──read (streamed, zip-slip safe)──▶ app tree
        └─ reconcile for sideloading: new bundle IDs, Info.plist keys, per-bundle profile + entitlements
        └─ additions: extra files and Info.plist keys from the caller (sealed like everything else)
        └─ sign bottom-up, for each nested framework / plug-in / loose dylib, then the app:
              embedded.mobileprovision → _CodeSignature/CodeResources (seal every file)
              → per Mach-O slice: patch LC_CODE_SIGNATURE + __LINKEDIT (codesign_allocate rules)
                → CodeDirectory (SHA-256, or SHA-1 + SHA-256 below iOS 11; 4 KB or 16 KB pages)
                → requirements + entitlements (XML + DER) → CMS (Apple cdhash attributes, WWDR chain)
                → SuperBlob; fat binaries reassembled
 app tree ──write (streamed, modes + symlinks kept)──▶ signed .ipa
```

## Using it

### Before any Apple call

`inspectIpa` reads the archive without changing it and fails early, before any App ID is spent:

- `signer.invalid_bundle` when there is no usable main app;
- `signer.encrypted_binary` when any Mach-O in the app is FairPlay-encrypted;
- `signer.extension_prefix` when an extension or watch app ID is not under the app's ID.

It also records what the app needs from a device: its `MinimumOSVersion`, its device families (`UIDeviceFamily`: 1 for iPhone and iPod touch, 2 for iPad; iPhone only when the key is absent, as on Apple's side) and the architectures of the main executable's slices (`arm64`, `arm64e`, `armv7`, …). `checkCompatibility(inspection, device)` compares them with the target device and returns the first problem, or nothing; `assertCompatible` throws it:

| Check | Fails with | `data` |
|---|---|---|
| The device's iOS is at least `MinimumOSVersion` (dotted, numeric: `9.3.5` < `10.0` < `26.1`) | `signer.unsupported_ios` | `minimumOSVersion`, `iosVersion` |
| The device runs one of the app's families: an iPhone or iPod touch needs family 1; an iPad takes 1 or 2, since it runs iPhone apps in compatibility mode. Other device classes are not checked | `signer.unsupported_device` | `deviceFamilies`, `deviceClass` |
| The main executable has an `arm64` or `arm64e` slice. Devices that run current iOS are 64-bit only, so a 32-bit-only (`armv7`) or simulator (`x86_64`) build fails. An executable that cannot be read is left to signing | `signer.no_arm64_build` | `architectures`, `supported` |

`planSideloadIdentity` turns the inspection into the identities to register for a team.

```ts
import {
  checkCompatibility,
  inspectIpa,
  planSideloadIdentity
} from '@ipaforge/signer'

const inspection = await inspectIpa(source, { signal })
// inspection.app: { path, identifier, name, version?, minimumOSVersion?, deviceFamilies, architectures }
// inspection.nested: every .appex (PlugIns/, Extensions/, Watch/*.app/PlugIns/) and watch app
// inspection.appGroups / keychainAccessGroups: from the main executable's entitlements
// inspection.altAppGroups: from the main app's Info.plist

checkCompatibility(inspection, { iosVersion: '18.0', deviceClass: 'iPhone' })
// undefined, or e.g. { code: "signer.unsupported_ios", data: { minimumOSVersion: "26.0", iosVersion: "18.0" } }

const plan = planSideloadIdentity(inspection, 'ABCDE12345')
// plan.newMainBundleId: "<original ID>.ABCDE12345"
// plan.bundles: [{ identifier, name }, …], main app first (the shape the developer services API provisions)
// plan.appGroup: "group.<newMainBundleId>" when the app declares any app group
// plan.appGroups: every declared group → plan.appGroup (pass as `sideload.appGroups`)
```

### Signing

```ts
import { bytesFileSource } from '@ipaforge/kernel'
import { resolveChain, signIpa } from '@ipaforge/signer'

// Bundled Apple intermediates first; unknown ones are downloaded from the certificate's issuer
// link and accepted only if they verifiably chain to a pinned Apple root.
const { chain } = await resolveChain(certificate, {
  fetchIssuer: (url) => http.getBytes(url)
})

const { ipa, summary } = await signIpa(
  bytesFileSource('SideStore.ipa', ipaBytes),
  {
    signing: {
      kind: 'identity',
      identity: { certificate, chain, privateKey }, // privateKey: CryptoKey
      teamId: 'ABCDE12345'
    },
    sideload: {
      teamId: 'ABCDE12345',
      newMainBundleId: 'com.SideStore.SideStore.ABCDE12345',
      certificate,
      profiles, // Map<new bundle ID, raw provisioning profile>
      deviceUdid,
      pruneUnprovisioned: true // drop extensions the account could not provision
    },
    onProgress: (event) => console.log(event.stage),
    signal // AbortSignal
  }
)
// `ipa` is a ReadableStream<Uint8Array>; `summary.bundles` lists every signed bundle and its cdhash.
```

### Adding content before signing

`additions` puts files and Info.plist keys into bundles after reconciliation and before signing, so the
signature seals them. The callback receives the discovered bundles with their **original** bundle IDs (before
any sideload rewrite), so it can recognise an app by the ID it ships with:

```ts
await signIpa(source, {
  signing,
  sideload,
  additions: (bundles) => [
    {
      bundlePath: '', // CodeBundle.path; "" is the main app
      files: new Map([['Config.bin', bytes]]), // paths relative to that bundle
      infoPlist: createDict([['SomeKey', 'value']]) // keys to set
    }
  ]
})
```

A file path that would leave its bundle (`..`, absolute, backslashes, empty segments), or a `bundlePath` that is
not a code bundle, fails with `signer.invalid_bundle`. The installer uses this hook to give SideStore its
certificate (`sideStoreCertificateAdditions`, see below).

### Exporting a certificate as PKCS#12

`exportPkcs12({ certificate, privateKey, password, friendlyName? })` turns a DER certificate and its PKCS#8 DER
private key into a `.p12` that iOS can import. iOS only accepts the **legacy** profile, so both the key bag and the
certificate bag use `pbeWithSHAAnd3-KeyTripleDES-CBC`, the MAC is HMAC-SHA1, and the iteration count is 2048
(`infrastructure/pkcs12/constants.ts`). WebCrypto has no DES, so this one module uses node-forge; nothing else in
the signer does. Bad input fails with `signer.invalid_certificate`. The output is checked with `openssl pkcs12
-info -legacy`.

SideStore holds the certificate this way so it can refresh apps by itself. The installer's
`sideStoreCertificateAdditions({ certificate, privateKey, serialNumber, machineId })` returns an `additions`
callback that writes `ALTCertificate.p12` (password = the certificate's `machineId`) and sets Info.plist
`ALTCertificateID` = serial number in SideStore's bundle, or in the SideStore framework inside LiveContainer. Any
other app gets nothing. Without a `machineId` it fails with `installer.certificate_machine_id_missing`.

### Tuning

Nothing in the engine is hard-coded beyond what the file formats themselves fix. Every tunable has a
default that matches Apple `codesign` and can be overridden per call:

```ts
await signIpa(source, {
  signing,
  // Page size, hash algorithms and CMS reservation. "codesign" follows Apple's own choice.
  policy: {
    pageSize: 'codesign',
    hashAlgorithms: 'codesign',
    cmsReservation: 18_000
  },
  // Hostile-input limits; override any subset.
  limits: {
    plist: {
      maxDepth: 64,
      maxExpandedNodes: 1_000_000,
      maxExpandedBytes: 64 * 1024 * 1024
    },
    machO: { maxFatArches: 16 },
    ipa: { maxEntries: 200_000, maxUncompressedBytes: 4 * 1024 ** 3 }
  },
  // Output archive: compression level 0–9 (0 = store), plus the stored-extension pattern,
  // the members dropped on read and the entry timestamp.
  archive: { compressionLevel: 0 }
})
```

The defaults are exported as `DEFAULT_SIGNING_POLICY`, `DEFAULT_SIGNER_LIMITS`, `DEFAULT_DROPPED_MEMBERS`,
`DEFAULT_STORED_EXTENSIONS` and `DEFAULT_ENTRY_DATE`. `signBundle` and `signBinary` take the same `policy`
and `limits`. `createHasher({ batchSize })` controls how many pages WebCrypto hashes concurrently.

Format constants are not options: blob magics, slot numbers and flags are in `domain/blobs/constants.ts`,
OIDs are in `infrastructure/cms/oids.ts` and `infrastructure/pkcs12/constants.ts`, and bundle paths and file modes are in `domain/bundle/layout.ts`.

Lower-level building blocks are also exported: `signBundle`, `signBinary`, `reconcileForSideload`, `readIpa`/`writeIpa`, `parseProvisioningProfile`, and the plist API (`parsePlist`, `serializeXmlPlist`). `inspectIpa` takes the same `limits`.

## How we know it's right

| Evidence | Where |
|---|---|
| Every signature blob (CodeDirectory incl. SHA-1 dual and 16 KB pages, requirements, entitlements, wrapper) of 10 signed executables is **byte-identical to Apple `codesign`** | `domain/blobs/blobs.test.ts` |
| Mach-O allocation (`LC_CODE_SIGNATURE`, `__LINKEDIT`, reservation size) identical to `codesign_allocate`, including re-signing and fat binaries | `domain/macho/allocate.test.ts` |
| `CodeResources` identical for the app, framework and plug-in | `domain/code-resources/code-resources.test.ts` |
| A whole `.app` signed ad-hoc is **file-for-file identical** to Apple's | `application/sign-bundle.test.ts` |
| Certificate-signed binaries, bundles, sideload-reconciled apps and written IPAs pass `codesign --verify --deep --strict` | macOS tests |
| CMS verifies with pkijs and `openssl cms` | `infrastructure/cms/cms.test.ts` |
| PKCS#12 export round-trips (key matches certificate, wrong password fails) and uses 3DES bags + HMAC-SHA1 at 2048 iterations | `infrastructure/pkcs12/pkcs12.test.ts` |
| Added files are sealed in their bundle's and their parent's `CodeResources` | `application/bundle-additions.test.ts` |
| Plist writer matches `plutil` byte for byte (including `%.17g` reals) | `domain/plist.test.ts` |
| Real SideStore 0.7.0-alpha is sideload-signed in ~0.5 s and verifies | `application/sign-ipa.test.ts` (`IPAFORGE_E2E=1`) |

The golden inputs and Apple outputs live in `fixtures/signer/` ([README](../fixtures/signer/README.md)). Regenerate them on macOS with `fixtures/signer/generate.sh`; `--check` fails when an Xcode update changes Apple's behaviour. Checking the CMS against a **real** Apple Development certificate is a one-command maintainer step: [`fixtures/signer/REAL-CERT.md`](../fixtures/signer/REAL-CERT.md).

## Rules worth knowing

| Rule | Why |
|---|---|
| Sign innermost bundles first, and write profiles before sealing | A parent's `CodeResources` hashes its children's *final* bytes |
| Each extension gets its own profile and entitlements | Otherwise installd reports "invalid entitlements" or "no valid provisioning profile" |
| Extension IDs must start with the app's ID | installd rejects them otherwise (`signer.extension_prefix`) |
| The app's `ALTAppGroups` is written into every extension and watch app | Extensions look up the shared app group at runtime |
| Concrete keychain groups are kept under the new team | When a profile grants `<TEAMID>.*`, the executable's own `keychain-access-groups` are re-prefixed with the team and signed if the profile allows them; anything dropped is logged. The old team comes from the executable's team identifier or application-identifier, else from its groups' own prefix: an extension may declare its app's groups without naming a team (LiveContainer's LiveProcess does), and they move with the app's |
| Team ID is written into every binary | Mixed or missing team IDs crash the app at launch |
| Encrypted (App Store) binaries are refused | FairPlay-encrypted apps cannot be re-signed; you need a decrypted IPA |
| 16 KB code pages for iOS 16+, SHA-1 + SHA-256 below iOS 11 | Matches Apple `codesign` 26 |

## Error codes

| Code | Meaning |
|---|---|
| `signer.invalid_macho` / `signer.unsupported_arch` | Not a usable Mach-O binary |
| `signer.unsupported_ios` / `signer.unsupported_device` / `signer.no_arm64_build` | The target device cannot run the app: iOS too old, wrong device family, or no 64-bit slice |
| `signer.encrypted_binary` | App Store build; needs a decrypted IPA |
| `signer.no_header_space` | Binary has no room for a signature load command |
| `signer.zip_slip` / `signer.invalid_bundle` | Unsafe or malformed archive, missing `Payload/*.app`, size limits |
| `plist.invalid` / `signer.invalid_certificate` / `signer.invalid_profile` | Malformed inputs |
| `signer.unknown_issuer` | The certificate's issuer is neither bundled nor downloadable and verifiable to an Apple root |
| `signer.extension_prefix` | Extension ID not under the app's ID |
| `signer.profile_mismatch` / `signer.profile_expired` / `signer.cert_not_in_profile` / `signer.device_not_provisioned` | Profile doesn't fit this app, certificate or device |

## See Also

- [Architecture](architecture.md): where the signer sits
- [Contributing](contributing.md): fixtures, tests and conventions
