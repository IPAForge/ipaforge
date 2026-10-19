import { daysLeft } from '@ui/features/apps/utils/expiry.ts'
import { isNewerVersion } from '@ui/features/apps/utils/is-newer-version.ts'
import { EXPIRES_SOON_DAYS } from '@ui/features/repair/constants.ts'
import type { CheckRow } from '@ui/features/repair/types.ts'
import type {
  SideStoreCheck,
  SideStoreHealth
} from '@ui/services/engine/types.ts'

const deviceRow = (check: SideStoreCheck, device: string): CheckRow => {
  const base = {
    id: 'device',
    titleKey: 'repair.device.title',
    values: { device }
  } as const

  if (check.locked)
    return {
      ...base,
      state: 'bad',
      detailKey: 'repair.device.locked',
      tagKey: 'repair.device.lockedTag'
    }
  if (check.developerMode === 'off')
    return {
      ...base,
      state: 'bad',
      detailKey: 'repair.device.developerMode',
      tagKey: 'repair.device.developerModeTag'
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.device.ok',
    tagKey: 'repair.ok'
  }
}

const signerRow = (health: SideStoreHealth): CheckRow => {
  const base = { id: 'signer', titleKey: 'repair.signer.title' } as const

  if (health.signedBy === 'other-team')
    return {
      ...base,
      state: 'warn',
      detailKey: 'repair.signer.otherTeam',
      tagKey: 'repair.signer.otherTeamTag'
    }
  if (health.signedBy === 'other-apple-id')
    return {
      ...base,
      state: 'warn',
      detailKey: 'repair.signer.otherAppleId',
      tagKey: 'repair.signer.otherAppleIdTag'
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.signer.ok',
    tagKey: 'repair.ok'
  }
}

const versionRow = (health: SideStoreHealth): CheckRow => {
  const version = health.version ?? '?'
  const base = { id: 'version', titleKey: 'repair.version.title' } as const

  if (!health.latest)
    return {
      ...base,
      state: 'unknown',
      detailKey: 'repair.version.unknown',
      tagKey: 'repair.unknown',
      values: { version }
    }
  if (health.version && isNewerVersion(health.latest, health.version))
    return {
      ...base,
      state: 'warn',
      detailKey: 'repair.version.outdated',
      tagKey: 'repair.version.outdatedTag',
      values: { version, latest: health.latest }
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.version.ok',
    tagKey: 'repair.ok',
    values: { version }
  }
}

const expiryRow = (health: SideStoreHealth, now: Date): CheckRow => {
  const days = daysLeft(health.expiresAt, now)
  const base = { id: 'expiry', titleKey: 'repair.expiry.title' } as const

  if (days === undefined)
    return {
      ...base,
      state: 'unknown',
      detailKey: 'repair.expiry.unknown',
      tagKey: 'repair.unknown'
    }
  if (days <= 0)
    return {
      ...base,
      state: 'bad',
      detailKey: 'repair.expiry.expired',
      tagKey: 'repair.expiry.expiredTag',
      values: { days: Math.max(1, Math.ceil(-days)) }
    }
  if (days <= EXPIRES_SOON_DAYS)
    return {
      ...base,
      state: 'warn',
      detailKey: 'repair.expiry.soon',
      tagKey: 'repair.expiry.soonTag',
      values: { days: Math.floor(days) }
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.expiry.ok',
    tagKey: 'repair.ok',
    values: { days: Math.floor(days) }
  }
}

const signingRow = (health: SideStoreHealth): CheckRow => {
  const base = { id: 'signing', titleKey: 'repair.signing.title' } as const

  if (health.signing === 'revoked')
    return {
      ...base,
      state: 'bad',
      detailKey: 'repair.signing.revoked',
      tagKey: 'repair.signing.revokedTag'
    }
  if (health.signing === 'unknown')
    return {
      ...base,
      state: 'unknown',
      detailKey: 'repair.signing.unknown',
      tagKey: 'repair.unknown'
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.signing.ok',
    tagKey: 'repair.ok'
  }
}

const ownCertificateRow = (health: SideStoreHealth): CheckRow => {
  const base = { id: 'own', titleKey: 'repair.own.title' } as const

  if (health.ownCertificate === 'missing')
    return {
      ...base,
      state: 'bad',
      detailKey: 'repair.own.missing',
      tagKey: 'repair.own.missingTag'
    }
  if (health.ownCertificate === 'other')
    return {
      ...base,
      state: 'warn',
      detailKey: 'repair.own.other',
      tagKey: 'repair.own.otherTag'
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.own.ok',
    tagKey: 'repair.ok'
  }
}

const pairingRow = (health: SideStoreHealth, device: string): CheckRow => {
  const base = {
    id: 'pairing',
    titleKey: 'repair.pairing.title',
    values: { device }
  } as const

  if (health.pairing === 'missing')
    return {
      ...base,
      state: 'bad',
      detailKey: 'repair.pairing.missing',
      tagKey: 'repair.pairing.missingTag'
    }
  if (health.pairing === 'other-computer')
    return {
      ...base,
      state: 'warn',
      detailKey: 'repair.pairing.other',
      tagKey: 'repair.pairing.otherTag'
    }

  return {
    ...base,
    state: 'ok',
    detailKey: 'repair.pairing.ok',
    tagKey: 'repair.ok'
  }
}

/**
 * The checks in words, one line each: the device first; when SideStore is there, who signed it, its version and
 * expiry, the certificates that signed it and that it holds, and its pairing file. A locked device shows only its
 * own line: nothing else can be read until it's unlocked.
 */
export const checkRows = (
  check: SideStoreCheck,
  device: string,
  now: Date
): readonly CheckRow[] => {
  const first = deviceRow(check, device)

  if (check.locked) return [first]

  const health = check.sideStore

  if (!health)
    return [
      first,
      {
        id: 'installed',
        state: 'bad',
        titleKey: 'repair.installed.title',
        detailKey: 'repair.installed.missing',
        tagKey: 'repair.installed.missingTag',
        values: { device }
      }
    ]

  return [
    first,
    signerRow(health),
    versionRow(health),
    expiryRow(health, now),
    signingRow(health),
    ownCertificateRow(health),
    pairingRow(health, device)
  ]
}
