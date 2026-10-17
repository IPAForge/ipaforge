import type { ReactNode } from 'react'
import type { useTranslation } from 'react-i18next'

import type { StatusTone } from '@ui/components/shell/types.ts'
import type { useDevices } from '@ui/hooks/queries/use-devices.ts'
import type { DeviceCheck } from '@ui/services/engine/types.ts'

export type DeviceState =
  | 'checking'
  | 'ready'
  | 'locked'
  | 'developerModeOff'
  | 'notTrusted'
  | 'unavailable'
  | 'notConnected'

export type StatusQuery = {
  readonly data?: DeviceCheck | undefined
  readonly error?: unknown
  readonly isFetching: boolean
}

export type DeviceView = {
  readonly name: string
  /** The name came from the device (false: "Unknown device", until a read succeeds). */
  readonly isNamed: boolean
  /** "iPhone17,1 · iOS 26.1 · USB": what is known, without the state. */
  readonly line: string
  /** "iPhone17,1 · iOS 26.1 · USB", then the state when it is not ready. */
  readonly subtitle: string
  /** "USB", "Wi-Fi" or "USB and Wi-Fi"; empty when not connected. */
  readonly link: string
  /** Undefined without a device. */
  readonly state: DeviceState | undefined
  /** The state in words, when it is not ready. */
  readonly stateText: string | undefined
  readonly tone: StatusTone
  readonly check: DeviceCheck | undefined
  /** Why the last read failed, when it did. */
  readonly error: unknown
  /** Connected over Wi-Fi only (it must be awake and unlocked to answer). */
  readonly isWifiOnly: boolean
}

export type DevicesQuery = ReturnType<typeof useDevices>

/** The device a notice is about. */
export type NoticeProps = {
  udid: string
  view: DeviceView
}

export type Notice = {
  readonly status: 'warning' | 'danger'
  readonly title: string
  readonly body: ReactNode
  /** Ask again (for Trust); null when the only thing to do is Check again. */
  readonly action: ReactNode
  readonly checkAgain: boolean
}

/** Builds the notice for a device in one state. */
export type NoticeBuilder = (
  t: ReturnType<typeof useTranslation>['t'],
  props: NoticeProps
) => Notice
