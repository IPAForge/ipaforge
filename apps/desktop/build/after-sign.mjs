// electron-builder afterSign hook: re-signs the macOS app with IPAForge's own (self-signed) certificate when the
// release workflow has put it in a keychain and exported its SHA-1 as IPAFORGE_CODESIGN_HASH. electron-builder only
// signs with identities macOS trusts, and Apple doesn't know this one, so the hook calls codesign itself.
//
// A stable certificate gives every build the same designated requirement, so the keychain keeps trusting
// IPAForge after an update. Gatekeeper still asks on first open: only a Developer ID certificate avoids that.
// Without the variable (local builds, forks) the app keeps electron-builder's ad-hoc signature.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

export default async (context) => {
  const hash = process.env.IPAFORGE_CODESIGN_HASH
  if (context.electronPlatformName !== 'darwin' || !hash) return

  const app = join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )
  execFileSync('codesign', ['--force', '--deep', '--sign', hash, app], {
    stdio: 'inherit'
  })
}
