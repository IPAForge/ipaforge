import { describe, expect, it } from 'vitest'

import type { CertificateChoice } from '@ipaforge/rpc'
import { certificateOrigin } from '@ui/features/install/prompts/utils/certificate-origin.ts'

const made = (machineName?: string) =>
  ({ machineName }) as unknown as CertificateChoice

describe('certificateOrigin', () => {
  it('knows its own certificates', () => {
    expect(certificateOrigin(made('IPAForge'))).toBe('ipaforge')
  })

  it('tells SideStore, a computer and an unnamed certificate apart', () => {
    expect(certificateOrigin(made('AltStore'))).toBe('sidestore')
    expect(certificateOrigin(made("Dan's MacBook Pro"))).toBe('machine')
    expect(certificateOrigin(made())).toBe('unknown')
  })
})
