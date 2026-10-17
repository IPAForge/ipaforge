import { useContext, useMemo, useSyncExternalStore } from 'react'

import { useAccounts } from '@ui/hooks/queries/use-accounts.ts'
import { useDevices } from '@ui/hooks/queries/use-devices.ts'
import type { Account } from '@ui/services/engine/engine-types.ts'
import { SelectionContext } from '@ui/state/selection/selection-context.ts'
import type {
  Selection,
  SelectionStore
} from '@ui/state/selection/selection-store.ts'

const useSelectionStore = (): SelectionStore => {
  const store = useContext(SelectionContext)
  if (!store) throw new Error('useSelection must be used inside <App>')
  return store
}

/** What is picked, and the setter that keeps it. */
export const useSelection = (): {
  readonly selection: Selection
  readonly select: SelectionStore['select']
} => {
  const store = useSelectionStore()

  return {
    selection: useSyncExternalStore(store.subscribe, store.getState),
    select: store.select
  }
}

/** The picked one while it is still there, otherwise the first. */
export const pickActive = <T extends { readonly id: string }>(
  items: readonly T[] | undefined,
  id: string | undefined
): T | undefined => items?.find((item) => item.id === id) ?? items?.[0]

/**
 * The devices an Apple ID's ban counts on: every connected device, until a device can be picked (then the picked
 * one).
 */
export const useDevicesInUse = (): readonly string[] => {
  const devices = useDevices().data

  return useMemo(() => devices?.map((device) => device.udid) ?? [], [devices])
}

/** The Apple ID in use: the picked one while it is saved, otherwise the first saved one. */
export const useActiveAccount = (): Account | undefined => {
  const { selection } = useSelection()

  return pickActive(useAccounts().data, selection.account)
}
