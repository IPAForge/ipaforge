# iOS .ipa re-signing: byte-level specification for a pure-TypeScript signer

Status: research reference. Every claim cites a source file and line(s). Paths are relative to the
research checkouts:

| Prefix | Source |
|---|---|
| `rcs/` | `apple-platform-rs/apple-codesign/src/` (indygreg rcodesign, git HEAD) |
| `cms-rs/` | `cryptography-rs/cryptographic-message-syntax/src/` (rcodesign's CMS builder) |
| `zsign/` | `zsign/src/` |
| `apple/` | Apple open source. `Security` is `main`; `machorep_120.cpp` is tag `Security-61901.120.67`, which is the exact `Security.framework` on this Mac (macOS 26.5, `CFBundleVersion 61901.120.67`). Also `cctools` `codesign_allocate.c` and `align.c`, and xnu `cs_blobs.h`. |
| `altsign/` | rileytestut/AltSign `ALTSigner.mm` |
| `exp/`, `tools/` | My experiments. `tools/proto_sign.py` and `tools/proto_coderes.py` are a ~300-line Python prototype of this spec. |

**Empirical validation.** I built the prototype in `tools/` from this spec. On macOS 26.5
(`codesign` from Security 61901.120.67), Apple's `codesign -s -` (ad-hoc) and the prototype
produced **byte-identical files** in all of these cases:

- a thin arm64 executable with entitlements, iOS min 15 (4 KiB pages)
- the same with iOS min 16 and 17 (16 KiB pages), including a binary with a 70 KB data blob
- an iOS min 10 executable (SHA-1 primary CD plus SHA-256 alternate CD)
- a fat arm64 + arm64e executable
- a loose dylib
- re-signing binaries that were already signed (the existing `LC_CODE_SIGNATURE` path)
- a complete `.app`: a framework, a loose dylib, an `.appex`, lproj files, `.DS_Store`, `PkgInfo`,
  a symlink, a subdirectory, and `embedded.mobileprovision`. `diff -r` against the
  codesign-signed tree was empty, and `codesign --verify --strict` reported "valid on disk".

Only the CMS blob was not tested this way: the Mac has no Apple-issued identity, and a self-signed
identity is rejected. Section 5 for CMS therefore comes from Apple's source, not from
`codesign` output.

---

## 0. Conventions

- **Code-signing structures are BIG-endian** (every blob, CodeDirectory field, and SuperBlob
  index). Mach-O headers and load commands are in the Mach-O's native order, which is
  little-endian for every iOS architecture (arm64, arm64e, armv7). Fat headers are big-endian.
  (`rcs/embedded_signature.rs:375-380`, `rcs/code_directory.rs:246-260`)
- A "blob" is `{u32 magic, u32 length (including this 8-byte header), payload}`.
  (`rcs/embedded_signature.rs:375-380, 524-535`)
- There is no padding between blobs inside the SuperBlob and no padding inside the
  CodeDirectory. The CodeDirectory length is not rounded. (`apple/cdbuilder.cpp:146-178`; verified)

---

## 1. SuperBlob (embedded signature)

### 1.1 Magic numbers (`apple/cs_blobs.h:92-101`, `rcs/embedded_signature.rs:89-120`)

| Name | Magic |
|---|---|
| CSMAGIC_REQUIREMENT | `0xfade0c00` |
| CSMAGIC_REQUIREMENTS (requirement set) | `0xfade0c01` |
| CSMAGIC_CODEDIRECTORY | `0xfade0c02` |
| CSMAGIC_EMBEDDED_SIGNATURE (SuperBlob) | `0xfade0cc0` |
| CSMAGIC_EMBEDDED_SIGNATURE_OLD | `0xfade0b02` |
| CSMAGIC_EMBEDDED_ENTITLEMENTS (XML) | `0xfade7171` |
| CSMAGIC_EMBEDDED_DER_ENTITLEMENTS | `0xfade7172` |
| CSMAGIC_EMBEDDED_LAUNCH_CONSTRAINT | `0xfade8181` |
| CSMAGIC_DETACHED_SIGNATURE | `0xfade0cc1` |
| CSMAGIC_BLOBWRAPPER (wraps CMS) | `0xfade0b01` |

### 1.2 Slot indices (`apple/cs_blobs.h:110-128`, `apple/codedirectory.h:94-124`)

| Slot | Value | Content |
|---|---|---|
| CodeDirectory (primary) | 0 | CD blob |
| Info (Info.plist) | 1 | hash only; no blob in the SuperBlob |
| Requirements | 2 | requirement-set blob |
| ResourceDir (CodeResources) | 3 | hash only |
| Application | 4 | unused |
| Entitlements (XML) | 5 | `0xfade7171` blob |
| RepSpecific | 6 | unused on iOS |
| DER entitlements | 7 | `0xfade7172` blob |
| Launch constraints (self / parent / responsible / library) | 8 / 9 / 10 / 11 | not used for apps |
| Alternate CDs | `0x1000`..`0x1004` | additional CDs, such as the SHA-256 CD when the primary is SHA-1 |
| Signature | `0x10000` | BlobWrapper containing the CMS DER |
| Identification / Ticket | `0x10001` / `0x10002` | not used |

### 1.3 Layout

```
u32 magic   = 0xfade0cc0
u32 length  = 12 + 8*count + sum(blob lengths)   // excludes trailing zero padding
u32 count
struct { u32 type; u32 offset; } index[count]   // offset is from the start of the SuperBlob
blobs...                                         // concatenated in index order
```
Index entries and blobs are sorted by **slot number, ascending**. The resulting order is
0, 2, 5, 7, 0x1000, 0x10000. Apple uses a `std::map` keyed by slot
(`apple/superblob.h:216-265`), and rcodesign uses a BTreeMap (`rcs/embedded_signature_builder.rs:53, 339-357`).
The first blob's offset is `12 + 8*count`. (`rcs/embedded_signature.rs:397-440`; verified)

### 1.4 Slots codesign emits (verified with `codesign`, `exp/`)

| Binary kind | Slots, in order |
|---|---|
| Main app or appex executable (MH_EXECUTE) with entitlements, SHA-256 only | 0, 2, 5, 7, 0x10000 |
| Same, iOS min < 11 (agile) | 0 (SHA-1 CD), 2, 5, 7, 0x1000 (SHA-256 CD), 0x10000 |
| Framework binary or dylib (MH_DYLIB) | 0, 2, 0x10000 |

- **Requirements (slot 2) is always present**, even when empty
  (`rcs/macho_signing.rs:687-695`: "Without it, validation fails").
- **Entitlements blobs (slots 5 and 7) are only written for MH_EXECUTE**
  (`mainBinary || mForceLibraryEntitlements`, `apple/signer.cpp:839-856`).
- **DER (slot 7) is always generated together with slot 5** (`generateEntitlementDER=true` at
  `apple/signer.cpp:670-672`).
- **The CMS wrapper (slot 0x10000) is always present.** For ad-hoc signing it is an empty
  8-byte BlobWrapper, `fade0b01 00000008` (verified).

**iOS 15–26 requirements.** For an app signed with a free Apple Development certificate, iOS
requires all of the following:

- CD version ≥ 0x20400
- a SHA-256 CodeDirectory, as primary or as alternate
- XML entitlements (slot 5) and DER entitlements (slot 7) on every MH_EXECUTE
- a non-empty CMS in slot 0x10000 that chains to Apple

Without DER entitlements or a modern CD, iOS 15+ rejects the app with "The code signature version
is no longer supported". rcodesign forces CD ≥ 0x20400 when the target is iOS ≥ 15
(`rcs/code_directory.rs:650-661`). The Sideloader/other signers signer always emits CD
0x20400, SHA-1 + SHA-256 CDs, slots 5 and 7, and an empty requirement set, and that output installs
in practice.

---

## 2. CodeDirectory

### 2.1 Header layout (offsets are from the blob start; all fields big-endian)

(`apple/codedirectory.h:193-260`, `rcs/code_directory.rs:241-334, 416-574`, verified byte-for-byte)

| Off | Size | Field | Since |
|---|---|---|---|
| 0x00 | 4 | magic `0xfade0c02` | |
| 0x04 | 4 | length (whole CD) | |
| 0x08 | 4 | version | |
| 0x0C | 4 | flags | |
| 0x10 | 4 | hashOffset: offset of code slot 0, so special slot −n is at `hashOffset − n*hashSize` | |
| 0x14 | 4 | identOffset | |
| 0x18 | 4 | nSpecialSlots | |
| 0x1C | 4 | nCodeSlots | |
| 0x20 | 4 | codeLimit | |
| 0x24 | 1 | hashSize (20 or 32) | |
| 0x25 | 1 | hashType (1 = SHA-1, 2 = SHA-256, 3 = SHA-256 truncated, 4 = SHA-384) | |
| 0x26 | 1 | platform (0 for us) | |
| 0x27 | 1 | pageSize as log2 (12 or 14) | |
| 0x28 | 4 | spare2 = 0 | |
| 0x2C | 4 | scatterOffset = 0 | 0x20100 |
| 0x30 | 4 | teamOffset (0 if no team) | 0x20200 |
| 0x34 | 4 | spare3 = 0 | 0x20300 |
| 0x38 | 8 | codeLimit64 (0 unless codeLimit > 4 GiB) | 0x20300 |
| 0x40 | 8 | execSegBase | 0x20400 |
| 0x48 | 8 | execSegLimit | 0x20400 |
| 0x50 | 8 | execSegFlags | 0x20400 |
| 0x58 | 4 | runtime | 0x20500 |
| 0x5C | 4 | preEncryptOffset | 0x20500 |
| 0x60 | 1, 1, 2, 4, 4 | linkageHashType, linkageTruncated, spare4, linkageOffset, linkageSize | 0x20600 |

The fixed header size is 48 bytes for v0x20100, 52 for 0x20200, 88 (0x58) for 0x20400, and 96 for
0x20500 (`apple/cdbuilder.cpp` `fixedSize`).

After the fixed header, the variable part is laid out in this order with no padding
(`apple/cdbuilder.cpp:250-286`):

```
identifier\0
teamID\0                          // only if a team ID is present; teamOffset points here
special slot hashes, -nSpecial .. -1   // highest slot first, so -7 is first and -1 is last
code slot hashes, 0 .. nCodeSlots-1    // hashOffset points at the first of these
```

`length = fixed + len(ident)+1 + (team ? len(team)+1 : 0) + (nSpecial + nCode) * hashSize`.

### 2.2 Version selection (Apple `Builder::build`, `apple/cdbuilder.cpp:203-215`)

```
if runtime != 0 || preEncrypt          -> 0x20500
else if execSegLimit > 0               -> 0x20400
else if codeLimit > UINT32_MAX         -> 0x20300
else if teamID non-empty               -> 0x20200
else                                   -> 0x20100
```

`execSegLimit > 0` holds for every Mach-O that has a platform load command (`LC_BUILD_VERSION` or
`LC_VERSION_MIN_IPHONEOS`) and a `__TEXT` segment (`apple/machorep.cpp:171-232`). In practice,
**iOS binaries always get 0x20400**. Do not set `runtime` on iOS. Apple only sets it with the
hardened-runtime flag (`apple/signer.cpp:651-655`).

### 2.3 Field values

- **flags**: identity signing uses `0`. Ad-hoc uses `0x2` (CS_ADHOC). Do not carry over old flags,
  and always drop `0x20000` LINKER_SIGNED (`rcs/macho_signing.rs:469-492`). Apple only inherits
  flags with `--preserve-metadata=flags`, and never from linker-signed code
  (`apple/signer.cpp:154-156`). The full table is in `apple/cs_blobs.h:36-74`: HOST 0x1, ADHOC 0x2,
  HARD 0x100, KILL 0x200, EXPIRES 0x400, RESTRICT 0x800, ENFORCEMENT 0x1000, LIBRARY_VALIDATION
  0x2000, RUNTIME 0x10000, LINKER_SIGNED 0x20000.
- **codeLimit**: the file offset (relative to the slice) where the SuperBlob starts, which equals
  the new `LC_CODE_SIGNATURE.dataoff` (Section 6). If it exceeds UINT32_MAX, Apple writes
  `codeLimit = 0xFFFFFFFF` and `codeLimit64 = value` (`apple/cdbuilder.cpp:226-231`). rcodesign
  writes 0 instead (`rcs/macho_signing.rs:497-500`); follow Apple.
- **Code slots**: split `slice[0 .. codeLimit)` into `pageSize` chunks and hash each one. The last
  chunk is hashed at its actual (short) length and is **not** zero-padded.
  `nCodeSlots = ceil(codeLimit / pageSize)` (`apple/cdbuilder.cpp:152-159, 289-300`). The hashed
  bytes are the **already-modified** Mach-O: patched header, patched LC_CODE_SIGNATURE, and patched
  `__LINKEDIT`, plus the zero padding up to `dataoff` (Section 6.3).
- **pageSize** depends on the codesign version. The rules in macOS 26.5 Security 61901.120.67
  (`apple/machorep_120.cpp:575-608`), all verified:
  ```
  if cputype in {ARM64 (0x0100000c), ARM64_32 (0x0200000c)}:
      platform == TVOS(3)        -> 4096
      platform == IOS(2)         -> minOS < 16.0.0 ? 4096 : 16384
      platform == WATCHOS(4)     -> minOS <  9.0.0 ? 4096 : 16384
      otherwise (incl. 0, macOS) -> 16384
  else                           -> 4096          // armv7, x86
  ```
  Older codesign versions (`apple/machorep.cpp` on `main` has a different variant, and rcodesign
  hard-codes 4096 at `rcs/macho_signing.rs:503`) may differ. The kernel accepts both sizes. Make
  the page size a parameter that defaults to the rule above.
  `minOS` comes from `LC_BUILD_VERSION.minos` (offset +12) or from `LC_VERSION_MIN_IPHONEOS.version`
  (offset +8), encoded as nibbles `xxxx.yy.zz`, i.e. `(major<<16)|(minor<<8)|patch`
  (`rcs/macho.rs:583-600`).
- **Hash algorithm(s)** (`apple/machorep.cpp:110-154`, `apple/signer.cpp:369-371`):
  - SHA-256 only, **unless** some slice has `platform == IOS/TVOS` with `minOS < 11.0`,
    `platform == MACOS` with `minOS < 10.11.4`, or `platform == WATCHOS` with `minOS < 12.0`. In
    that case **SHA-1 is the primary CD (slot 0) and SHA-256 is the alternate (slot 0x1000)**.
  - Unknown platform (0) means SHA-256 only. rcodesign differs here (`rcs/signing_settings.rs:958-983`).
  - The decision applies to the whole file: if any slice needs SHA-1, every slice gets both CDs.
  - Primary-CD rule: the SHA-1 CD goes in slot 0 when present. Otherwise the lowest hashType goes
    in slot 0, and the others go in 0x1000, 0x1001, ... in ascending hashType order
    (`apple/signerutils.cpp:415-448`). Verified with `exp/s_app_ios10`.
- **platform** = 0.
- **identifier**:
  - Bundle executables (app, appex, framework) use `CFBundleIdentifier` from that bundle's
    Info.plist.
  - Loose dylibs with an identity use `canonicalIdentifier(filename)`: strip any directory, then
    drop the last `.ext` unless it starts with a digit (`libFoo.dylib` becomes `libFoo`), then trim
    numeric version suffixes (`apple/diskrep.cpp:286-317`, `apple/signer.cpp:159-175`).
  - Ad-hoc and no dot in the name: append `"-" + hex("UUID" + LC_UUID bytes)`, for example
    `libloose-55554944de32...` (`apple/machorep.cpp:236-262`; verified).
  - Sideloaders use the file name . That is fine for iOS but differs from
    codesign.
- **teamID**: the leaf certificate's subject OU. Only include it for Apple-issued certificates
  (`apple/signer.cpp:76-95`, `rcs/signing_settings.rs:484-500`). It must be present and identical
  on **every** binary: the main executable, appexes, frameworks, and dylibs. Otherwise library
  validation fails ("different Team IDs").
- **execSegBase / execSegLimit**: `__TEXT.fileoff` and `__TEXT.filesize` of that slice. Both are 0
  when there is no platform load command (`apple/machorep.cpp:171-232`). zsign uses
  `__TEXT.vmsize` and base 0 (`zsign/archo.cpp:51-53`, `zsign/signing.cpp:486-487`). That is
  usually equal, but follow Apple.
- **execSegFlags** (`apple/cs_blobs.h:80-86`, `apple/signer.cpp:808, 854, 1089-1100`,
  `rcs/entitlements.rs:13-52`). Start from `MAIN_BINARY (0x1)` if `filetype == MH_EXECUTE (2)`,
  else 0. Then OR in these flags when the matching entitlement is boolean `true`:

  | Entitlement | Flag |
  |---|---|
  | `get-task-allow` | `ALLOW_UNSIGNED 0x10` |
  | `run-unsigned-code` | `0x10` |
  | `com.apple.private.cs.debugger` | `DEBUGGER 0x20` |
  | `dynamic-codesigning` | `JIT 0x40` |
  | `com.apple.private.skip-library-validation` | `0x80` |
  | `com.apple.private.amfi.can-load-cdhash` | `0x100` |
  | `com.apple.private.amfi.can-execute-cdhash` | `0x200` |

  A free development profile always has `get-task-allow = true`, so the main app and each appex
  get **0x11**, and frameworks and dylibs get **0x0** (verified).

### 2.4 Special slots

`nSpecialSlots` is the **highest slot number filled**, and unfilled slots below it are zero hashes
(`apple/cdbuilder.cpp:55-64, 274-277`, `rcs/code_directory.rs:430-544`). Each special slot holds the
CD's hash algorithm applied to:

| Slot | Hashed data |
|---|---|
| −1 Info | the **raw bytes of the bundle's `Info.plist` file** (XML or binary, exactly as on disk). Only set for bundle executables. |
| −2 Requirements | the complete requirement-set blob, header included |
| −3 ResourceDir | the raw bytes of `_CodeSignature/CodeResources` |
| −5 Entitlements | the complete `0xfade7171` blob, header included |
| −7 DER entitlements | the complete `0xfade7172` blob, header included |

Typical values (verified):

| Binary | nSpecialSlots |
|---|---|
| App or appex executable | 7 |
| Framework binary | 3 (−1, −2, −3) |
| Loose dylib | 2 (−2 is set; −1 is all zeros) |

### 2.5 cdhash

`cdhash = H(entire CD blob)`, where H is that CD's own algorithm, **truncated to 20 bytes**
(`CS_CDHASH_LEN = 20`, `apple/cs_blobs.h:142`, `apple/codedirectory.cpp:350-359`). The CMS V2
attribute uses the full digest.

---

## 3. Requirements blob

### 3.1 Structure (`apple/requirement.h:51-94`, `rcs/embedded_signature.rs:596-662`, `zsign/signing.cpp:141-259`)

```
RequirementSet: u32 0xfade0c01, u32 length, u32 count,
                {u32 type, u32 offset}[count]   // offset from the start of the set blob, sorted by type
                Requirement blobs...
Requirement:    u32 0xfade0c00, u32 length, u32 kind = 1 (exprForm), expression...
```

Type values: host 1, guest 2, **designated 3**, library 4, plugin 5 (`rcs/code_requirement.rs:85-97`).

**Empty set** (ad-hoc, also what Sideloader/other signers ship): `fade0c01 0000000c 00000000`
(verified). iOS accepts an empty set: zsign ad-hoc
mode install with it. installd/AMFI do not evaluate the designated requirement (DR) on install.

### 3.2 Designated requirement for an Apple Development certificate

Apple's DRMaker uses this form when the chain is leaf → intermediate carrying OID
`1.2.840.113635.100.6.2.1` → Apple root (`apple/drmaker.cpp:62-82, 121-147, 190-197`):

```
identifier "<CD identifier>" and anchor apple generic
  and certificate leaf[subject.CN] = "<leaf CN>"
  and certificate 1[field.1.2.840.113635.100.6.2.1] /* exists */
```

The binary is **right-nested prefix**: `And(ident, And(anchorGeneric, And(certField, certGeneric)))`.
`csreq -b` would produce left-nested Ands from the same text, so do not use it as the reference
(verified in `exp/`). Each u32 is big-endian:

```
00000006                       opAnd
00000002 <data identifier>     opIdent
00000006                       opAnd
0000000f                       opAppleGenericAnchor
00000006                       opAnd
0000000b 00000000 <data "subject.CN"> 00000001 <data CN>   opCertField, slot 0 (leaf), matchEqual
0000000e 00000001 <data 2a864886f76364060201> 00000000     opCertGeneric, slot 1, OID bytes, matchExists
```

`<data X>` is `u32 len, bytes, zero padding to a 4-byte boundary` (`rcs/code_requirement.rs:142-155`).

Opcodes (`rcs/code_requirement.rs:233-258`): False 0, True 1, Ident 2, AppleAnchor 3,
AnchorHash 4, InfoKeyValue 5, And 6, Or 7, CDHash 8, Not 9, InfoKeyField 10, CertField 11,
TrustedCert 12, TrustedCerts 13, CertGeneric 14, AppleGenericAnchor 15, EntitlementField 16,
CertPolicy 17, NamedAnchor 18, NamedCode 19, Platform 20, Notarized 21, CertFieldDate 22,
LegacyDevID 23.

Match types (`rcs/code_requirement.rs:895-911`): Exists 0, Equal 1, Contains 2, BeginsWith 3,
EndsWith 4, <, >, <=, >= are 5–8, Absent 14.

Worked example: identifier `com.example.test`, CN
`Apple Development: Test Person (ABCDE12345)`. It is 176 bytes and `csreq -r -t` decodes it to the
expected text:
```
fade0c01000000b0000000010000000300000014
fade0c000000009c00000001
00000006 00000002 00000010 636f6d2e6578616d706c652e74657374
00000006 0000000f 00000006
0000000b 00000000 0000000a 7375626a6563742e434e0000 00000001 0000002b 4170706c6520446576656c6f706d656e743a205465737420506572736f6e2028414243444531323334352900
0000000e 00000001 0000000a 2a864886f763640602010000 00000000
```
**Decision:** emit this DR when signing with an identity (it matches codesign), and the empty set
for ad-hoc. Use the CD's identifier and the leaf's subject CN.

---

## 4. Entitlements

### 4.1 XML blob (slot 5)

`fade7171 | u32 len+8 | XML bytes`. codesign embeds the `--entitlements` file **verbatim** and
does not re-serialize it (verified in `exp/e3`). To produce Xcode-like output, serialize with the
CoreFoundation XML writer (Section 7.4). When comparing with codesign, pass codesign the exact
bytes you generated.

### 4.2 DER blob (slot 7)

`fade7172 | u32 len+8 | DER` (`apple/signer.cpp:1059-1100` calls `CESerializeCFDictionary`).
The encoding below is verified against codesign in `exp/e2`, and matches `rcs/plist_der.rs:25-260`
and its test vectors at lines 381-421:

```
Top:      [APPLICATION 16] constructed (tag 0x70) { INTEGER 1 (02 01 01), <dict> }
Dict:     [CONTEXT 16] constructed (tag 0xB0) { SEQUENCE (0x30) { UTF8String key (0x0C), value } ... }
          entries sorted by key, bytewise (UTF-8); nested dicts also use 0xB0
Array:    SEQUENCE 0x30 { values... }
Bool:     01 01 FF / 01 01 00
Integer:  02, minimal two's complement (0 -> 02 01 00, 128 -> 02 02 00 80, -1 -> 02 01 FF)
String:   0C, UTF-8 bytes
Lengths:  DER definite form (<128 short, else 0x81 nn / 0x82 nnnn)
Real / Date / Data: not representable; reject them
```

Example (verified): the dict `{zeta:{b:128,a:-1}, Zcap:"é", alpha:[], alpha-:false, alph:0}` encodes to
`704f020101b04a 300a0c045a6361700c02c3a9 30090c04616c7068020100 30090c05616c7068613000 300b0c06616c7068612d010100 30190c047a657461b011 30060c01610201ff 30070c0162020200 80`.

**Bug in other signers: it encodes nested dicts with 0x31.** That is wrong
. Use 0xB0. zsign's integer encoder is also buggy (`zsign/signing.cpp:30-39`).

### 4.3 Which binaries get entitlements

Only MH_EXECUTE: the app executable and each appex executable. Each one gets the entitlements
**of its own provisioning profile** (`altsign/ALTSigner.mm:190-244`).
Frameworks and dylibs get no entitlement blobs (codesign behaviour). zsign and other signers add an empty
dict to them, which is also tolerated (`zsign/archo.cpp:340-345`).

---

## 5. CMS signature (slot 0x10000)

### 5.1 Structure (`apple/signer.cpp:885-940`, `apple/cmssiginfo.c:250-380, 1414-1525`, `apple/cmsattr.c:244-272`, `rcs/embedded_signature_builder.rs:210-311`, `zsign/openssl.cpp:358-521`)

```
BlobWrapper: fade0b01 | u32 len+8 | DER(ContentInfo)

ContentInfo ::= SEQUENCE {
  contentType  1.2.840.113549.1.7.2 (signedData)
  content [0] EXPLICIT SignedData ::= SEQUENCE {
    version 1
    digestAlgorithms SET { AlgId{2.16.840.1.101.3.4.2.1 sha256, NULL} }
    encapContentInfo SEQUENCE { eContentType 1.2.840.113549.1.7.1 (id-data) }   -- detached: no eContent
    certificates [0] IMPLICIT SET { leaf, Apple WWDR intermediate, Apple Root CA }
    signerInfos SET { SignerInfo ::= SEQUENCE {
      version 1
      sid IssuerAndSerialNumber(leaf)
      digestAlgorithm AlgId{sha256, NULL}
      signedAttrs [0] IMPLICIT SET (DER-sorted, see below) {
        contentType   1.2.840.113549.1.9.3 = id-data
        signingTime   1.2.840.113549.1.9.5 = UTCTime "YYMMDDHHMMSSZ" (GeneralizedTime outside 1950-2049)
        messageDigest 1.2.840.113549.1.9.4 = OCTET STRING SHA-256(primary CD blob bytes)
        1.2.840.113635.100.9.2 ("CDHashes2", hash agility V2) = SET of values, one per CD:
                      SEQUENCE { OID hashAlg, OCTET STRING full H(CD) }
        1.2.840.113635.100.9.1 ("cdhashes" plist, V1) = OCTET STRING <XML plist>
      }
      signatureAlgorithm AlgId{1.2.840.113549.1.1.11 sha256WithRSAEncryption, NULL}
      signature OCTET STRING  RSASSA-PKCS1-v1_5-SHA256(DER(SET OF signedAttrs))
    }}}}
```

Details:

- **The detached content is the primary CD** (slot 0; the SHA-1 CD in agile mode). It is hashed
  with **SHA-256** regardless of the CD's own algorithm. The digest algorithm is always SHA-256
  (`apple/signer.cpp:901`; `rcs/embedded_signature_builder.rs:272` hashes `main_cd`).
- **V1 cdhashes plist**: `{cdhashes: [<20-byte cdhash of CD0>, <20-byte cdhash of CD 0x1000>, ...]}`.
  The CDs are in ascending hashType order: SHA-1 CD then SHA-256 CD, which is also primary then
  alternate (`apple/signerutils.cpp:450-458`). It is serialized by the CF XML writer, ends with
  `</plist>\n`, and is 278 bytes for one CD. Exact bytes are shown below and in Section 7.4.
  rcodesign appends `\n` itself (`rcs/embedded_signature_builder.rs:263-269`).
  ```
  <?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0">\n<dict>\n\t<key>cdhashes</key>\n\t<array>\n\t\t<data>\n\t\t<base64 20 bytes>\n\t\t</data>\n\t</array>\n</dict>\n</plist>\n
  ```
- **V2**: one AttributeValue per CD, `SEQUENCE { OID, OCTET STRING full digest }`. The OID is
  SHA-1 `1.3.14.3.2.26` for the SHA-1 CD (20-byte value) and SHA-256 `2.16.840.1.101.3.4.2.1` for
  the SHA-256 CD (32-byte value) (`apple/signerutils.cpp:460-500`, `apple/cmssiginfo.c:1455-1525`).
  - zsign only puts the SHA-256 entry in V2, and it only lists hashes of CDs that actually exist
    (`zsign/signing.cpp:680-718`).
  - **Never list a CD that is not in the SuperBlob**; doing so produces errSecCSSignatureFailed
    (`zsign/signing.cpp:680-690`).
  - Value order inside the SET in agile mode: Apple iterates a CFDictionary, so the order is
    unspecified. Use DER order; verifiers do not care.
- **signedAttrs ordering**: DER SET OF, sorted by each Attribute's full encoding bytewise
  (`apple/cmssiginfo.c:315-330` `SecCmsAttributeArrayReorder`; `cms-rs/signing.rs:363-368`). Because
  the length byte comes second, for SHA-256-only the order is: contentType (`30 18`),
  signingTime (`30 1c`), messageDigest (`30 2f`), V2 (`30 3c`), V1 (`30 82 ...`).
- **Signature**: computed over the DER of the signedAttrs re-tagged as `SET (0x31)`
  (RFC 5652 §5.4).
- **AlgorithmIdentifier parameters** (confirmed with a real certificate: `signatureAlgorithm` is
  sha256WithRSAEncryption **with** an explicit NULL): Apple writes an explicit NULL for sha256 and for
  sha256WithRSA (`apple/secalgid.c:59-95`, which adds NULL for SHA-* and RSA OIDs). other signers does the
  same ( `sha256_algorithm_identifier`). rcodesign omits it. Both verify.
- **Certificates**:
  - Apple uses chain mode `WithRootOrFail`: leaf + intermediate + root (`apple/signer.cpp:899`,
    `apple/cmssiginfo.c:1735-1736`).
  - Pick the WWDR intermediate that issued the leaf. Free "Apple Development" certificates are
    currently issued by **WWDR G3** (RSA, chains to "Apple Root CA"). zsign ships G1–G8 and matches
    them by issuer-name hash; G2 and G6 chain to "Apple Root CA – G3" (`zsign/openssl.cpp:317-330, 380-433`).
  - other signers bundles AppleWWDRCAG3 and AppleIncRootCertificate .
  - **Order (verified 2026-10-15 with a real Apple Development certificate, codesign-83.100.6):** codesign
    DER-sorts the certificate SET like any `SET OF`. For a WWDR G3 leaf that gives G3, Apple Root CA, then
    the leaf, effectively ordered by encoded length. Verifiers accept any order; IPAForge matches Apple.
- **No timestamp** (iOS does not need one) and no smimeCapabilities (zsign uses `CMS_NOSMIMECAP`,
  `zsign/openssl.cpp:440`).
- **Byte-identity with codesign**: given the same signing time, RSA PKCS#1 v1.5 is deterministic,
  so the CMS can only match codesign if the attribute and certificate encodings also match.
  codesign has no CLI flag to fix the signing time, so compare the CMS **structurally** and compare
  every other byte exactly (Section 10).

### 5.2 Size reservation

codesign reserves **18000 bytes** for CMS (`apple/CodeSigner.cpp:327-330`, `state.mCMSSize`). A
typical WWDR-chained CMS is about 4.5–5 KB.

---

## 6. Mach-O modification (matches `codesign_allocate`, `apple/codesign_allocate.c:355-860`)

### 6.1 Parsing

- Thin magics: `0xfeedfacf` (64-bit, 32-byte header) and `0xfeedface` (32-bit, 28-byte header).
- Fat header: big-endian `0xcafebabe`, `u32 nfat_arch`, then `{i32 cputype, i32 cpusubtype,
  u32 offset, u32 size, u32 align}` repeated, 20 bytes each. `0xcafebabf` (fat_arch_64) is not
  used for iOS.
- `mach_header(_64)`: magic, cputype@4, cpusubtype@8, filetype@12, **ncmds@16, sizeofcmds@20**,
  flags@24, reserved@28 (64-bit only).
- `LC_SEGMENT_64` (`0x19`, 72 bytes + 80 per section): segname@8 (16 bytes), vmaddr@24, **vmsize@32**,
  fileoff@40, **filesize@48** (all u64), maxprot@56, initprot@60, nsects@64, flags@68.
- `LC_SEGMENT` (`0x1`, 56 bytes + 68 per section): vmaddr@24, **vmsize@28**, fileoff@32,
  **filesize@36** (all u32).
- `LC_CODE_SIGNATURE` (`0x1d`): `linkedit_data_command {cmd, cmdsize=16, dataoff, datasize}`.
- Other commands used: `LC_BUILD_VERSION 0x32 {platform@8, minos@12, sdk@16}`,
  `LC_VERSION_MIN_IPHONEOS 0x25 {version@8}`, `LC_UUID 0x1b`, and
  `LC_ENCRYPTION_INFO(_64) 0x21/0x2C {cryptoff, cryptsize, cryptid@16}`.

### 6.2 Preconditions (`rcs/macho.rs:315-363`)

- `__LINKEDIT` must be the last segment by file offset.
- If a signature exists, nothing may follow it in `__LINKEDIT`.
- If no signature exists, there must be room for 16 more bytes of load commands:
  `sizeofcmds + 16 + headerSize <= lowest file offset of any non-empty, non-zerofill section`.
  If not, fail with "relink with larger -headerpad" (`apple/codesign_allocate.c:888-940`).
- **Refuse FairPlay-encrypted slices** (`LC_ENCRYPTION_INFO.cryptid != 0`). zsign detects this at
  `zsign/archo.cpp:91-99`.

### 6.3 Algorithm per slice (verified byte-identical, including the re-sign path)

```
sigStart   = existing LC_CODE_SIGNATURE ? lc.dataoff : (linkedit.fileoff + linkedit.filesize)
dataoff    = alignUp(sigStart, 16)                      // codesign_allocate rnd32(...,16)
srcExtent  = existing ? lc.dataoff : sliceLength        // used only for the size estimate
datasize   = alignUp( 12 + 8*count + sum(len(piece)) + sum(estCD) + 18000 , 16 )
   count   = #pieces + #CDs + 1      pieces = requirement set, XML entitlements, DER entitlements (the blobs actually emitted)
   estCD   = 96 + len(ident)+1 + (team ? len(team)+1 : 0) + (ceil(srcExtent/pageSize) + nSpecialSlots) * hashSize
             // Apple sizes CDs with the 0x20500 header (96 bytes) and the *source* extent
             // (apple/signer.cpp:684-688, apple/cdbuilder.cpp:146-178, apple/signerutils.cpp:192-198, apple/superblob.h:216-242)
segalign   = 2 ^ min over all segments of guess_align(vmaddr, lo = (64-bit ? 3 : 2), hi = 15)
             guess_align(v): v == 0 ? 15 : clamp(trailingZeroBits(v), lo, 15)     (apple/align.c)
newFileSz  = dataoff + datasize - linkedit.fileoff
linkedit.filesize = newFileSz
linkedit.vmsize   = newFileSz > linkedit.vmsize ? alignUp(newFileSz, segalign) : linkedit.vmsize   // only ever grows
if no LC_CODE_SIGNATURE:
    write {0x1d, 16, dataoff, datasize} at headerSize + sizeofcmds;  ncmds += 1;  sizeofcmds += 16
else:
    lc.dataoff = dataoff; lc.datasize = datasize
newSlice   = input slice bytes, truncated or zero-extended to (dataoff + datasize), with the patches above applied
codeLimit  = dataoff;  hash newSlice[0 .. dataoff) for the CDs
write the SuperBlob at dataoff
```

Notes:

- **Bytes after the SuperBlob** keep the *input* file's bytes at the same offsets, or zero past the
  input's end. When re-signing, codesign leaves stale bytes from the old signature there (verified:
  `exp/rs_cs`). Zeros are equally valid, but byte-identical comparison needs the stale bytes.
- rcodesign always recomputes vmsize as `alignUp(filesize, 16384)` (`rcs/macho_signing.rs:71-78`).
  That is not what codesign does.
- If a slice has an existing signature, cctools recomputes `dataoff` from the end of the
  symbol/string tables (`codesign_allocate.c:700-740`). That equals the old `dataoff` for every
  normally linked binary. Assume they are equal, and fail if `__LINKEDIT` content does not end
  within 15 bytes of the old `dataoff`.

### 6.4 Fat (universal) files (verified: `exp/s_app_fat`)

- Sign each slice independently, with the same identifier, Info.plist, CodeResources, and
  entitlements.
- Apply the SHA-1/SHA-256 decision across all slices (Section 2.3).
- Rebuild the fat file, keeping each `fat_arch.align` (normally 14):
  ```
  offset = alignUp(8 + 20*n, 2^align[0]);  for each arch: offset = alignUp(offset, 2^align); write; offset += size
  ```
- Zero-fill the gaps. Slice order and cputype/cpusubtype stay unchanged. The first arm64 slice
  starts at 0x4000.

---

## 7. Bundle signing

### 7.1 Order (bottom-up; a parent seals its children's final bytes)

1. For every nested bundle, deepest first: `*.framework`, `*.appex` (in `PlugIns/` and
   `Extensions/`), `Watch/*.app` and its `PlugIns`, `*.xctest`. Process each bundle's own
   contents first (zsign `GetObjectsToSign` sorts by depth descending, `zsign/bundle.cpp:73-105`;
   rcodesign at `rcs/bundle_signing.rs:172-180`).
2. Loose Mach-O files inside a bundle (`Frameworks/*.dylib`, helper executables) are signed
   before that bundle's CodeResources is generated (,
   `zsign/bundle.cpp:276-289`). Identify them by magic, not by extension.
3. For each bundle:
   - write `embedded.mobileprovision` (its own profile) **before** sealing (`zsign/bundle.cpp:362-379`)
   - generate `_CodeSignature/CodeResources`
   - sign the bundle executable (`CFBundleExecutable`), passing the Info.plist and CodeResources
     bytes for slots −1 and −3
4. The main `.app` comes last.

### 7.2 iOS bundles are "flat": no nested-code sealing

An iOS `.app`'s resources directory is the bundle root, so `resourcesRelativePath == ""`.
Apple therefore uses the **flat-bundle rules without any `nested` rule**
(`apple/bundlediskrep.cpp:672-701`). Consequences, all verified:

- Nested frameworks and appexes are **not** sealed with `cdhash` / `requirement` entries. **Every
  file inside them** is sealed as an ordinary resource: their executable,
  `_CodeSignature/CodeResources`, Info.plist, resources, and nested `embedded.mobileprovision`.
- **Ignore** rcodesign's macOS-style `nested` rules and `cdhash`/`requirement` entries
  (`rcs/code_resources.rs:845-865, 970-1010, 1276-1310`); they do not apply here.

### 7.3 CodeResources content (exactly what codesign 26.5 produced, `exp/Payload/Test.app/_CodeSignature/CodeResources`)

**Rules (v1)** (`apple/bundlediskrep.cpp:682-688`):

```
'^.*'                              = true
'^.*\.lproj/'                      = {optional, weight 1000}
'^.*\.lproj/locversion.plist$'     = {omit, weight 1100}
'^Base\.lproj/'                    = {weight 1010}
'^version.plist$'                  = true
```

**Rules2** (`apple/bundlediskrep.cpp:689-699`):

```
'^.*' = true
'.*\.dSYM($|/)'              = {weight 11}
'^(.*/)?\.DS_Store$'         = {omit, weight 2000}
'^Info\.plist$'              = {omit, weight 20}
'^version\.plist$'           = {weight 20}
'^embedded\.provisionprofile$' = {weight 20}      // macOS name; embedded.mobileprovision falls under '^.*'
'^PkgInfo$'                  = {omit, weight 20}
'^.*\.lproj/'                = {optional, weight 1000}
'^Base\.lproj/'              = {weight 1010}
'^.*\.lproj/locversion.plist$' = {omit, weight 1100}
```

**Exclusions** (`apple/bundlediskrep.cpp:453-470`) take priority over all rules
(`apple/resources.cpp:330-360`):

- `^_CodeSignature$` (a directory, skipped whole)
- `^CodeResources$`
- `^_MASReceipt$`
- `^<escaped main executable name>$`

These anchor only at the bundle root, so `Frameworks/X.framework/_CodeSignature/CodeResources`
**is** sealed.

**Matching** (`apple/resources.cpp:330-360`):

- POSIX ERE (`regcomp REG_EXTENDED|REG_NOSUB`), unanchored unless the pattern says otherwise.
- Matched against the path relative to the bundle root, using `/`.
- An exclusion match ends the search. Otherwise the highest weight wins; on a tie the first one
  found wins, but no tie can occur with these rules.
- Absent weight = 1. A rule value of `true` means weight 1, no flags.
- `omit` means the file is not sealed.

**Walk** (`apple/resources.cpp:152-305`): `fts` physical walk; symlinks are not followed.

- Directory matching an exclusion: skip the whole subtree.
- Regular file: apply the rule.
- Symlink: rule applied, with nested cleared.
- Empty directories: nothing recorded.

**files2** (`apple/signer.cpp:458-536`): for every non-omitted file and symlink:

- Regular file: `{hash2: SHA-256(file)}`, plus `optional: true` if the rule is optional. Add
  `hash: SHA-1` **only if SHA-1 is among the signing digests**, i.e. in agile mode
  (`apple/resources.cpp:380-400` `hashName`). zsign and other signers always add `hash`. That is harmless but
  differs from codesign.
- Symlink: `{symlink: readlink target}`.
- Result: `.DS_Store`, root `Info.plist`, root `PkgInfo`, and `*.lproj/locversion.plist` are
  **absent from files2**.

**files (v1)** (`apple/signer.cpp:538-576`): regular files only (no symlinks), sealed with the v1
rules, which do not omit `.DS_Store`, `Info.plist` or `PkgInfo`.

- Value is `<data>SHA-1</data>` when the rule has no flags.
- Value is `{hash: SHA-1, optional: true}` when the rule is optional (lproj).

**Rule values written to the plist**:

- A flag-less weight-1 rule is written as `<true/>`.
- Otherwise it is a dict with `omit`/`optional` set to `true`, `nested` if present, and
  `weight` as `<real>N</real>`.

### 7.4 CF XML plist writer: exact format, verified with `plutil` and codesign

```
<?xml version="1.0" encoding="UTF-8"?>\n
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n
<plist version="1.0">\n
<root value at depth 0>
</plist>\n
```

- Indentation is one TAB per depth level. Dict keys are written at depth+1 as `<key>K</key>`.
- **Keys are sorted with CFStringCompare(…, 0), which is UTF-16 code-unit order** (ASCII order for
  ASCII keys: uppercase before lowercase, `(` before `.`).
- Scalars:
  - `<true/>`, `<false/>`
  - `<integer>%d</integer>`
  - `<real>` uses C `%.17g` (corrected 2026-10-13 against `plutil`): `1000` → `1000`, `0.1` → `0.10000000000000001`, `1e-5` → `1.0000000000000001e-05`
  - `<string>` with only `&`, `<`, `>` escaped as `&amp;` `&lt;` `&gt;`; quotes are left as-is; UTF-8 raw
- Empty containers are `<dict/>` and `<array/>`.
- `<data>`:
  ```
  TABS<data>\n
  TABS<base64 line>\n...
  TABS</data>\n
  ```
  Each base64 line holds **76 − 8·depth characters**: 68 at depth 1, 60 at depth 2, 52 at depth 3,
  44 at depth 4.
- `tools/proto_coderes.py` `cf_xml` implements this and reproduced codesign's CodeResources
  byte-for-byte.

### 7.5 Info.plist and other files

- Slot −1 hashes whatever bytes are on disk. If you rewrite Info.plist (bundle ID changes), do it
  before sealing; XML or binary are both fine. Other signers write binary.
  zsign writes XML.
- Delete the old `_CodeSignature/` directories before signing (`SideStore ResignAppOperation.swift`
  `prepare`).
- Delete `SC_Info/` (the FairPlay sinf). If you remove appexes, prune `SC_Info/Manifest.plist`
  `SinfReplicationPaths` (SideStore `removeMissingAppExtensionReferences`).
- `embedded.mobileprovision` is the raw profile (CMS). It is sealed as a normal resource in
  `files` and `files2`.
- Remove `Watch/` (and `com.apple.WatchPlaceholder`) for free accounts if watch app IDs cannot be
  provisioned.

---

## 8. iOS sideloading specifics

### 8.1 Bundle ID rewriting

- **Main app**: sideloaders commonly use `<orig>.<TEAMID>` (SideStore/AltStore append the team ID).
  zsign uses an arbitrary new ID.
- **Extensions**: `new = newMain + orig[oldMain.len..]`. **Fail** if the appex ID is not prefixed
  by the old main ID (SideStore `prepare`). installd rejects an appex
  whose bundle ID is not prefixed by its parent app's ID.
- **Watch keys** to rewrite by string replacement (`zsign/bundle.cpp:480-516`):
  - `WKCompanionAppBundleIdentifier`
  - `NSExtension.NSExtensionAttributes.WKAppBundleIdentifier`
- **Also rewrite**:
  - `BGTaskSchedulerPermittedIdentifiers`, prefix match, de-duplicated (SideStore
    `rewrittenTaskSchedulerIdentifiers`)
  - `NSExtension.NSExtensionFileProviderDocumentGroup` → the matching new app group (SideStore `prepare`)
- **Optional**: remove `DTXcode`/`DTXcodeBuild`, and `UISupportedDevices` (zsign option).
- **IPAForge**: `inspectIpa` applies the prefix rule to every `.appex` (`PlugIns/`, `Extensions/`,
  `Watch/*.app/PlugIns/`) and watch app before any Apple call; `planSideloadIdentity` derives
  `<orig>.<TEAMID>`, the nested IDs and `group.<newMainBundleID>` from the inspection.

### 8.2 Entitlements

- **Use the provisioning profile's `Entitlements` dictionary for each executable, taken from that
  executable's own profile** (AltSign `ALTSigner.mm:190-244`,
  zsign `openssl.cpp:860-868`). This automatically satisfies "entitlements ⊆ profile" and strips
  entitlements a free account cannot use (push, iCloud, associated domains, and so on).
- A free profile typically contains:
  - `application-identifier = TEAMID.bundleid`
  - `com.apple.developer.team-identifier = TEAMID`
  - `get-task-allow = true`
  - `keychain-access-groups = ["TEAMID.*"]`
  - `com.apple.security.application-groups = [...]`, only if a group was assigned to that App ID
  - other capabilities the account enabled (e.g. increased-memory-limit)
- **If you merge the app's original entitlements instead**, every key must be permitted by the
  profile:
  - `application-identifier` must equal the profile's value exactly.
  - `keychain-access-groups` must match the profile's patterns; `TEAMID.*` covers `TEAMID.anything`.
  - `com.apple.security.application-groups` must be a subset of the profile's groups.
  - `get-task-allow` must equal the profile's value.
  - Drop everything else the profile lacks. Failure gives MI error 0xe8008016 (invalid entitlements).
- **App groups** (AltStore/SideStore app-group handling):
  - register `group.<newMainBundleID>`, enable the `APG3427HIY` feature, and assign it to every App ID
  - then download profiles (they then contain the group)
  - SideStore/AltStore also put `ALTAppGroups` in Info.plist; IPAForge writes the app's rewritten list
    into every extension and watch app too, even when they had no such key
  - code that hard-codes the old group ID will not work; that cannot be fixed by signing
- **Keychain groups (IPAForge)**: when the profile grants a wildcard (`TEAMID.*`) and the executable's
  original entitlements list concrete `keychain-access-groups`, IPAForge signs with those groups instead:
  the old team prefix (from `com.apple.developer.team-identifier` or the `application-identifier`
  prefix) or a literal `$(AppIdentifierPrefix)` becomes `TEAMID.`, and only groups the profile's patterns
  allow are kept (dropped ones are logged). If none survive, the profile's value is used.
- **Team ID**: profile `TeamIdentifier[0]` == leaf OU == CD teamID == the `application-identifier`
  prefix.

### 8.3 Certificate and profile

- The leaf certificate must be listed in the profile's `DeveloperCertificates`; zsign uses that
  list to find the certificate that pairs with the key (`zsign/openssl.cpp:925-945`).
- The device UDID must be in `ProvisionedDevices`.
- Free profiles expire after 7 days.
- Parse the profile (a CMS SignedData with an XML plist eContent):
  - Note: the eContent may be BER constructed/indefinite.
  - A tolerant shortcut is to slice from `<?xml` to `</plist>`.
  - other signers parses it as DER .

---

## 9. Known failure modes and how the references avoid them

(MI = `MIInstallerErrorDomain`/installd. The numeric codes are as reported by
libimobiledevice/AltStore tooling; treat them as approximate.)

| Symptom | Typical cause | Prevention |
|---|---|---|
| "A valid provisioning profile for this executable was not found" (0xe8008015) | `embedded.mobileprovision` missing in the app **or any appex**; appex given the main app's profile; `application-identifier`/bundle ID mismatch; leaf certificate not in `DeveloperCertificates`; UDID not provisioned; profile expired; Team ID in CD ≠ profile | Write a per-bundle profile before sealing (`zsign/bundle.cpp:362-379`, `altsign` `prepareApp`); CD identifier = rewritten `CFBundleIdentifier`; teamID from the leaf OU |
| "The executable was signed with invalid entitlements" (0xe8008016) | entitlements not ⊆ profile (keychain groups, app groups, aps-environment, …); `get-task-allow` mismatch | Use the profile's entitlements verbatim (Section 8.2) |
| "A signed resource has been added, modified, or deleted" (0xe8008017) / "sealed resource is missing or invalid" | file changed after its parent was sealed (wrong order); profile written after sealing; symlink zipped as a regular file; CodeResources hashing the pre-signature copy of a nested binary | Strict bottom-up order (Section 7.1); hash nested binaries after signing them ( test `direct_dylibs_are_hashed_from_their_final_signed_contents`); keep symlinks as symlinks in the zip |
| "The code signature version is no longer supported" (iOS 15+) | CD < 0x20400 or no DER entitlements | Always CD 0x20400 + slot 7 for executables |
| "verification failed" / errSecCSSignatureFailed | cdhashes plist or V2 lists a CD that is not present; messageDigest not computed over the slot-0 CD; signedAttrs not DER-sorted; chain lacks WWDR | Section 5.1; zsign comment `signing.cpp:680-690` |
| Crash at launch: "code signature invalid", "different Team IDs" | unsigned or foreign-team framework/dylib; teamID missing on dylibs | Sign every Mach-O, including loose `.dylib`s and helper executables (detect by magic, `zsign/bundle.cpp:107-134`), with the same team |
| Encrypted app crashes or fails to install | FairPlay (`cryptid=1`) | Refuse; require a decrypted IPA |
| "Unable to install … integrity could not be verified" | bad CMS chain, revoked/expired certificate (0xe8008018 "identity … no longer valid") | Correct WWDR intermediate (Section 5.1) |
| Fails only for an appex or watch app | missing App ID, profile, or prefix rule | Register App IDs for every appex (SideStore's per-extension App ID registration) or remove the appex |
| Dev-signed apps will not launch on iOS 16+ | Developer Mode off | User action |

Mach-O-level pitfalls:

- Missing room for a new load command (`-headerpad`).
- Data after the signature.
- `__LINKEDIT` not last.
- Forgetting to update `ncmds`/`sizeofcmds`.
- Hashing pages *before* patching the load commands. The CD covers the header, so page 0 changes
  when `LC_CODE_SIGNATURE` or `__LINKEDIT` change. Patch first, hash second
  (`rcs/macho_signing.rs:348-378` uses a two-pass placeholder approach; with the deterministic
  `datasize` formula from Section 6.3 you need only one pass).
- Signature larger than the reservation: fail. Keep the 18000-byte CMS reservation.

---

## 10. Verification recipe against codesign

- **Ad-hoc parity (fully deterministic)**: `codesign -f -s - -i <id> --entitlements <ourXML> <file>`
  must equal our ad-hoc output byte-for-byte, for thin, fat, re-signed binaries, and whole bundles.
  `codesign` signs one bundle at a time; run it bottom-up (frameworks, dylibs, appex, app).
  The prototype `tools/proto_sign.py` and `tools/proto_coderes.py` passes all of these.
- **Identity signing**: import the Apple Development `.p12` into a temporary keychain, then run
  `codesign -f --keychain <kc> -s "<CN>" --entitlements <xml> ...`. Expect every byte to be equal
  except:
  1. CD `flags` (0 instead of 2)
  2. the teamID string
  3. the requirement set (DR)
  4. the CMS blob

  Items 1–3 are deterministic and must match. Compare the CMS structurally: attributes, certs,
  algorithm IDs, and V1/V2 values.
- **Inspection commands**:
  ```
  codesign -dvvvvv <bin>           # v=20400, flags, hashes=N+M, Page size, CandidateCDHash, exec segment
  codesign -d --entitlements :- <bin>
  codesign -d -r- <bin>
  codesign --verify --strict -vvv <app>
  ```
  To decode the CMS:
  ```
  openssl cms -cmsout -print -inform DER -in <cms.der>
  ```

---

## 11. Open uncertainties

1. **Page size depends on the codesign version.** 61901.120.67 (macOS 26.5) uses 16 KiB for
   iOS arm64 with minOS ≥ 16, verified. Older codesign versions and rcodesign/zsign/other signers use
   4 KiB. Apple's GitHub `main` has a slightly different switch (16 KiB for all non-tvOS arm64).
   Make it a parameter.
2. **Resolved 2026-10-15** (real Apple Development certificate, `compare-real-cert`): certificates are
   DER-sorted; `signatureAlgorithm` is sha256WithRSAEncryption with an explicit NULL. The remaining CMS bytes
   differ only by signing time and signature value. Originally open:
   - Apple's certificate ordering inside the SET
   - whether `signatureAlgorithm` is sha256WithRSA (per current source) or rsaEncryption (older NSS)
   - the V2 value order in agile mode
3. **DER entitlement key order for non-ASCII keys**: verified bytewise for ASCII. CoreEntitlements
   might sort by UTF-16 for non-BMP characters. That is irrelevant in practice.
4. **MI numeric error codes** in Section 9 are community-sourced; the message strings are reliable.
5. **iOS acceptance of SHA-256-only versus agile signatures**: both are accepted on iOS 14–26.
   codesign emits SHA-256-only for minOS ≥ 11 and zsign now defaults to SHA-256-only. other signers always
   emits agile signatures and works too.
