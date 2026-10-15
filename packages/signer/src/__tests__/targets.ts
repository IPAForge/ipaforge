// Test-only: every signed executable in the golden fixtures, with what codesign fed into it.
import { type FixtureCase, loadManifest } from '@signer/__tests__/fixtures.ts'

export type SignedTarget = {
  readonly label: string
  /** Path parts of the binary under inputs/ and expected/. */
  readonly binary: readonly string[]
  readonly identifier: string
  readonly role: FixtureCase['role']
  readonly entitlements: string | null
  readonly infoPlist?: readonly string[]
  readonly codeResources?: readonly string[]
}

export const signedTargets = (): SignedTarget[] =>
  loadManifest().cases.flatMap((c): SignedTarget[] => {
    if (c.kind === 'binary') {
      return [
        {
          label: c.name,
          binary: [c.name],
          identifier: c.identifier,
          role: c.role,
          entitlements: c.entitlements
        }
      ]
    }
    const app: SignedTarget = {
      label: `${c.name} (main)`,
      binary: [c.name, 'Test'],
      identifier: c.identifier,
      role: 'main',
      entitlements: c.entitlements,
      infoPlist: [c.name, 'Info.plist'],
      codeResources: [c.name, '_CodeSignature', 'CodeResources']
    }
    const nested = (c.nested ?? []).map((n): SignedTarget => {
      const parts = n.path.split('/')
      const isBundle = !n.path.endsWith('.dylib')
      const executable = parts.at(-1)?.replace(/\.(framework|appex)$/, '') ?? ''

      return {
        label: `${c.name}/${n.path}`,
        binary: isBundle ? [c.name, ...parts, executable] : [c.name, ...parts],
        identifier: n.identifier,
        role: n.role,
        entitlements: n.entitlements,
        ...(isBundle
          ? {
              infoPlist: [c.name, ...parts, 'Info.plist'],
              codeResources: [
                c.name,
                ...parts,
                '_CodeSignature',
                'CodeResources'
              ]
            }
          : {})
      }
    })

    return [app, ...nested]
  })
