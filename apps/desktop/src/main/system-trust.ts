// Node trusts only its bundled roots by default. Adding the OS's certificates to that default, once at startup,
// covers what doesn't go through the HTTP adapter (the anisette WebSocket, the update signature checks), so a
// company proxy or a self-hosted anisette server trusted by the OS is trusted here too.
import { getCACertificates, setDefaultCACertificates } from 'node:tls'

import { systemCertificates } from '@desktop/main/adapters/http/trusted-roots.ts'
import type { Logger } from '@ipaforge/kernel'

export const trustSystemCertificates = (logger: Logger): void => {
  const system = systemCertificates()
  try {
    setDefaultCACertificates([
      ...new Set([...getCACertificates('default'), ...system])
    ])
    logger.info('trusting the system certificates too', {
      count: system.length
    })
  } catch (error) {
    logger.warn('could not add the system certificates', { error })
  }
}
