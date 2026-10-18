// `apple-probe developer`: read-only listing of teams, devices, certificates and App IDs.
import type { AppleProbe } from '@desktop/probes/apple/context.ts'
import { obtainSession } from '@desktop/probes/apple/session.ts'
import type { DeveloperServices, Team } from '@ipaforge/apple'

/** `YYYY-MM-DD`. */
const day = (date: Date): string => date.toISOString().slice(0, 10)

/** A line of an indented list, with its leading line break. */
const listItem = (text: string): string => `\n    - ${text}`

const printDevices = async (developer: DeveloperServices, team: Team) => {
  const devices = await developer.devices(team)
  const names = devices.map((d) => listItem(d.name ?? '?')).join('')
  console.log(`  devices: ${devices.length}${names}`)
}

const printCertificates = async (developer: DeveloperServices, team: Team) => {
  const certificates = await developer.certificates(team)
  console.log(`  iOS development certificates: ${certificates.length}`)
  for (const certificate of certificates) {
    const madeBy = certificate.machineName ?? certificate.name ?? '?'
    const expires = certificate.expiresAt ? day(certificate.expiresAt) : '?'
    console.log(`    - made by "${madeBy}", expires ${expires}`)
  }
}

const printAppIds = async (developer: DeveloperServices, team: Team) => {
  const { appIds, quota } = await developer.appIds(team)
  const max = quota.max ? ` of ${quota.max}` : ''
  console.log(
    `  App IDs: ${appIds.length}, available now: ${quota.available}${max}`
  )
  for (const appId of appIds) {
    const frees = appId.expiresAt ? ` (frees ${day(appId.expiresAt)})` : ''
    console.log(`    - ${appId.identifier}${frees}`)
  }
}

export const developerCommand =
  (probe: AppleProbe) => async (): Promise<void> => {
    console.log(
      'Read-only: lists teams, devices, certificates and App IDs. Nothing is created or changed.'
    )
    const developer = probe.apple.developer(await obtainSession(probe))
    for (const team of await developer.teams()) {
      console.log(
        `\nTeam ${team.name} [${team.id}] ${team.isFree ? '(free)' : ''} ${team.type ?? ''} ${team.status ?? ''}`
      )
      await printDevices(developer, team)
      await printCertificates(developer, team)
      await printAppIds(developer, team)
    }
  }
