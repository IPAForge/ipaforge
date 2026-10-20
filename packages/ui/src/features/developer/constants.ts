/** The Developer Portal's tabs, in order. */
export const portalTabs = [
  'certificates',
  'appIds',
  'profiles',
  'groups',
  'devices'
] as const

/** Each tab's label. */
export const portalTabLabelKeys = {
  certificates: 'portal.tabs.certificates',
  appIds: 'portal.tabs.appIds',
  profiles: 'portal.tabs.profiles',
  groups: 'portal.tabs.groups',
  devices: 'portal.tabs.devices'
} as const

/** How many development certificates a free team can hold at once. */
export const FREE_CERTIFICATE_LIMIT = 2

/** How many devices a paid team can register in a membership year. */
export const PAID_DEVICE_LIMIT = 100

/** The classes of a row's tag, by tone. */
export const tagClasses = {
  neutral: 'bg-surface-tertiary text-muted',
  accent: 'bg-accent text-accent-foreground',
  ok: 'bg-success-soft text-success-soft-foreground',
  warn: 'bg-warning-soft text-warning-soft-foreground',
  bad: 'bg-danger-soft text-danger-soft-foreground'
} as const

/** A certificate's maker, by who made it; IPAForge's own on this computer is told apart by its stored key. */
export const certificateMakerKeys = {
  thisComputer: 'portal.certificates.maker.thisComputer',
  ipaforge: 'portal.certificates.maker.ipaforge',
  sidestore: 'portal.certificates.maker.sidestore',
  machine: 'portal.certificates.maker.machine',
  unknown: 'portal.certificates.maker.unknown'
} as const

/** What revoking a certificate means for its maker, said in the confirmation. */
export const revokeNoteKeys = {
  thisComputer: 'portal.revokeDialog.thisComputer',
  sidestore: 'portal.revokeDialog.sidestore',
  machine: 'portal.revokeDialog.machine'
} as const
