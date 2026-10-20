import type { ServerFormProblems } from '@ui/features/settings/anisette/types.ts'
import type { AnisetteServerEntry } from '@ui/services/engine/types.ts'

/** The address without trailing slashes, lower case: how the Engine tells two servers apart. */
export const serverKey = (address: string): string => {
  let end = address.length
  while (end > 0 && address[end - 1] === '/') end -= 1

  return address.slice(0, end).trim().toLowerCase()
}

const isHttpAddress = (address: string): boolean => {
  if (!URL.canParse(address)) return false
  const { protocol } = new URL(address)

  return protocol === 'https:' || protocol === 'http:'
}

/**
 * What's wrong with the server as typed, before the Engine is asked: no name, not an http(s) address, or one in
 * the list already (`editing`: the address the server had, which it may keep).
 */
export const serverFormProblems = (
  name: string,
  address: string,
  servers: readonly AnisetteServerEntry[],
  editing?: string
): ServerFormProblems => {
  const trimmed = address.trim()
  const taken = servers.some(
    (server) =>
      serverKey(server.address) === serverKey(trimmed) &&
      (editing === undefined ||
        serverKey(server.address) !== serverKey(editing))
  )
  let addressProblem: ServerFormProblems['address']
  if (!isHttpAddress(trimmed))
    addressProblem = 'settings.anisette.dialog.addressInvalid'
  else if (taken) addressProblem = 'settings.anisette.dialog.exists'

  return {
    ...(name.trim() ? {} : { name: 'settings.anisette.dialog.nameMissing' }),
    ...(addressProblem ? { address: addressProblem } : {})
  }
}
