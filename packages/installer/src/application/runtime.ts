// What one run of a flow holds besides its state: the open device and the Apple session. Both are opened on first
// use, so a run resumed from a checkpoint reopens them without repeating the steps that produced them.
import type { InstallerDeps } from '@installer/types.ts'
import type { AppleSession, DeveloperServices } from '@ipaforge/apple'
import type { DeviceHandle } from '@ipaforge/device'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

export type FlowRuntime = {
  readonly deps: InstallerDeps
  /** The device, opened on first use. It is never paired here: an untrusted device fails with `device.not_paired`. */
  device(udid: string): Promise<DeviceHandle>
  /** Developer services for the session the sign-in step produced, or else the account's saved session. */
  developer(accountId: string): Promise<DeveloperServices>
  useSession(session: AppleSession): void
  close(): Promise<void>
}

const savedSession = async (
  deps: InstallerDeps,
  accountId: string
): Promise<AppleSession> => {
  const resumed = await deps.apple.resume(accountId)
  if (resumed.kind === 'signed_in') return resumed.session
  throw new IPAForgeError(ErrorCode.SessionExpired, {
    message: 'sign in again',
    data: { account: accountId }
  })
}

export const createFlowRuntime = (deps: InstallerDeps): FlowRuntime => {
  let device: Promise<DeviceHandle> | undefined
  let session: AppleSession | undefined
  let developer: DeveloperServices | undefined

  const openDevice = (udid: string): Promise<DeviceHandle> => {
    device ??= deps.devices.open(udid, { autoPair: false })
    // A failed open must not stick: the next attempt (an idempotent retry) opens again.
    device.catch(() => {
      device = undefined
    })
    return device
  }

  return {
    deps,
    device: openDevice,
    developer: async (accountId) => {
      session ??= await savedSession(deps, accountId)
      developer ??= deps.apple.developer(session)
      return developer
    },
    useSession: (next) => {
      session = next
      developer = undefined
    },
    close: async () => {
      const opened = device
      device = undefined
      await opened?.then((handle) => handle.close()).catch(() => {})
    }
  }
}
