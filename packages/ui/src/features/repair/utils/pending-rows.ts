import { pendingChecks } from '@ui/features/repair/constants.ts'
import type { CheckRow } from '@ui/features/repair/types.ts'

/** A check not in yet: its title, a spinner and "Checking…". */
export const pendingRow = (row: CheckRow): CheckRow => ({
  ...row,
  state: 'checking',
  tagKey: 'repair.checkingTag'
})

/** Every check while IPAForge asks, before any result. */
export const pendingRows = (device: string): readonly CheckRow[] =>
  pendingChecks.map((check) =>
    pendingRow({
      ...check,
      state: 'checking',
      detailKey: 'repair.checking',
      tagKey: 'repair.checkingTag',
      values: { device }
    })
  )
