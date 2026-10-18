# Verifying the signer against a real Apple Development certificate

Golden fixtures prove byte parity with Apple `codesign` for **ad-hoc** signatures, and CI checks that certificate-signed output passes `codesign --verify`. One thing needs a real Apple-issued certificate, which CI can't have: whether IPAForge's **CMS** matches Apple's structurally (certificate chain and order, algorithm identifiers, signed attributes) for an Apple Development identity. That was signer-spec open uncertainty #2.

## Run it (macOS, about 1 minute)

1. Export a **disposable** Apple Development identity as a `.p12`:
   - Xcode → Settings → Accounts → Manage Certificates, or
   - Keychain Access → right-click the certificate → Export.

   A free Apple ID's development certificate is fine. You can revoke it afterwards.
2. Run:

   ```bash
   IPAFORGE_P12_PASSWORD='…' pnpm --filter @ipaforge/signer compare-real-cert -- --p12 ~/Downloads/identity.p12
   ```

The script:

- imports the `.p12` into a **temporary keychain** and deletes it at the end; your login keychain is never touched;
- signs the fixture `Test.app` bottom-up with Apple `codesign` (`--timestamp=none`), and with IPAForge using the same certificate and key;
- compares every SuperBlob blob of every executable byte for byte, except the CMS: CodeDirectories (flags 0, team ID), the requirements set (Apple's designated-requirement form) and the entitlements;
- compares the CMS structurally with `openssl cms -cmsout -print`, masking only the signing time and signature value;
- runs `codesign --verify --deep --strict` on IPAForge's output.

## Results log

| Date | Certificate issuer | Result | Notes |
|---|---|---|---|
| 2026-10-15 | WWDR G3 (free account) | 2 CMS differences found and fixed | Apple DER-sorts the certificate SET (G3, root, leaf) and writes an explicit NULL for sha256WithRSA. All other blobs were identical. The main app's CodeDirectory differs only in the CodeResources hash (nested binaries carry different signing times). Also: Macs with only the expired WWDR G1 show the certificate as "not trusted"; the script now imports the chain itself |

If a check fails, the script keeps both CMS dumps (`*.apple.txt`, `*.ours.txt`) in the printed temp directory. Diff them, fix `packages/signer/src/infrastructure/cms/sign.ts`, and record the finding in `docs/design/signer-spec.md` §5 and §11.
