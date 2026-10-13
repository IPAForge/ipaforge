# Signer golden fixtures

Apple's `codesign` is the oracle for `@loadstar/signer`. Every case here is a small iOS binary or bundle:

- `inputs/` contains the unsigned binaries and bundles, plus one already-signed binary for the re-sign case;
- `expected/` contains the same inputs **ad-hoc signed by Apple `codesign`**, bottom-up.

The signer must reproduce `expected/` byte for byte, up to the end of each SuperBlob. Apple leaves stale bytes in the unused part of the signature reservation, and nothing hashes them.

| Case | Covers |
|---|---|
| `thin-min10` | SHA-1 primary + SHA-256 alternate CodeDirectories (minOS < 11) |
| `thin-min14` | SHA-256, 4 KiB pages; adding `LC_CODE_SIGNATURE` |
| `thin-min16` | SHA-256, 16 KiB pages (minOS ≥ 16, codesign 26.x) |
| `fat` | arm64 + arm64e universal binary, per-slice signing |
| `nosig.dylib` | dylib role: no entitlements, exec-seg flags 0 |
| `resign` | replacing an existing signature (different team, `get-task-allow` false, integer entitlement) |
| `Test.app` | bundle: framework, loose dylib, appex, binary `Info.plist`, `PkgInfo`, `.lproj`, `Base.lproj`, symlink, `.DS_Store`, `embedded.mobileprovision`, nested resources |

`manifest.json` lists every case and the toolchain versions that produced it.

## Regenerating (macOS only)

```bash
fixtures/signer/generate.sh          # rewrite inputs/, expected/, manifest.json
fixtures/signer/generate.sh --check  # rebuild in a temp dir and fail if anything differs
```

The output is deterministic for a given toolchain. If `--check` fails after an Xcode update, Apple changed its signing behaviour. Review the diff, regenerate, and update `docs/design/signer-spec.md` when a rule changed (for example the 16 KiB page-size switch).

`.gitattributes` marks this directory `-text` so git never rewrites line endings, which would break byte comparisons on Windows.
