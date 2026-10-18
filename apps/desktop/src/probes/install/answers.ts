// Answers the Engine's prompts in the terminal. An empty or invalid choice declines the prompt.
import type { Prompt } from '@desktop/probes/shared/types.ts'
import type { TwoFactorMethod } from '@ipaforge/apple'
import {
  type PromptData,
  type PromptHandler,
  PromptKind,
  type PromptRequest
} from '@ipaforge/installer'
import { ErrorCode, IPAForgeError } from '@ipaforge/kernel'

const declined = (): IPAForgeError =>
  new IPAForgeError(ErrorCode.PromptCancelled)

/** Lists `labels` and returns the index picked (1-based on screen). */
const choose = async (
  prompt: Prompt,
  question: string,
  labels: readonly string[]
): Promise<number> => {
  for (const [i, label] of labels.entries())
    console.log(`    ${i + 1}. ${label}`)
  const index =
    Number(
      (
        await prompt.ask(
          `  ${question} [1-${labels.length}, empty to cancel]: `
        )
      ).trim()
    ) - 1
  if (Number.isInteger(index) && index >= 0 && index < labels.length)
    return index
  throw declined()
}

const at = <T>(items: readonly T[], index: number): T => {
  const item = items[index]
  if (item === undefined) throw declined()
  return item
}

const day = (iso: string | undefined): string => (iso ? iso.slice(0, 10) : '?')

const methodLabel = (
  method: TwoFactorMethod,
  phones: PromptData<typeof PromptKind.TwoFactorMethod>['methods']['phones']
) =>
  method.type === 'sms'
    ? `SMS to ${phones.find((phone) => phone.id === method.phoneId)?.number ?? '?'}`
    : 'code on a trusted device'

type Handlers = {
  readonly [K in PromptKind]: (
    prompt: Prompt,
    data: PromptData<K>
  ) => Promise<unknown>
}

const HANDLERS: Handlers = {
  [PromptKind.Password]: (prompt, { appleId }) =>
    prompt.askHidden(`  Password for ${appleId} (hidden): `),
  [PromptKind.TwoFactorMethod]: async (prompt, { methods }) => {
    const options: TwoFactorMethod[] = [
      ...(methods.trustedDevice ? [{ type: 'trusted_device' as const }] : []),
      ...methods.phones.map((phone) => ({
        type: 'sms' as const,
        phoneId: phone.id
      }))
    ]
    const labels = options.map((method) => methodLabel(method, methods.phones))

    return at(options, await choose(prompt, 'Second factor', labels))
  },
  [PromptKind.TwoFactorCode]: async (prompt, { codeLength, retry }) => {
    if (retry) console.log('  That code was not accepted; try again.')
    return (await prompt.ask(`  Enter the ${codeLength}-digit code: `)).trim()
  },
  [PromptKind.ChooseTeam]: async (prompt, { teams }) => {
    const labels = teams.map(
      (team) => `${team.name} [${team.id}]${team.isFree ? ' (free)' : ''}`
    )

    return at(teams, await choose(prompt, 'Team', labels)).id
  },
  [PromptKind.RevokeCertificate]: async (prompt, { certificates }) => {
    console.log(
      '  The team has no room for another certificate. Revoking one stops the apps signed with it.'
    )
    const labels = certificates.map(
      (c) => `made by "${c.machineName}", expires ${day(c.expiresAt)}`
    )

    return at(certificates, await choose(prompt, 'Revoke', labels)).serialNumber
  },
  [PromptKind.ChooseAppToRemove]: async (prompt, { apps, limit }) => {
    console.log(
      `  A free team can have ${limit} apps on this device. Removing one deletes it and its data.`
    )
    const labels = apps.map((app) =>
      app.name ? `${app.name} (${app.bundleId})` : app.bundleId
    )

    return at(apps, await choose(prompt, 'Remove', labels)).bundleId
  },
  [PromptKind.ShareCertificate]: (prompt, { appName, bundleId }) =>
    prompt.confirm(
      `  "${appName}" (${bundleId}) was imported by hand and looks like SideStore. Give it your signing certificate and private key? [y/N] `
    ),
  [PromptKind.ChoosePairingApps]: async (prompt, { apps }) => {
    for (const [i, app] of apps.entries())
      console.log(`    ${i + 1}. ${app.appName} (${app.bundleId})`)
    const picked = (
      await prompt.ask(
        '  Place the pairing file into [numbers, comma separated, or all]: '
      )
    ).trim()
    if (picked === 'all') return apps.map((app) => app.bundleId)
    return picked
      .split(',')
      .map((entry) => apps[Number(entry.trim()) - 1]?.bundleId)
      .filter((bundleId): bundleId is string => bundleId !== undefined)
  }
}

const isPromptKind = (kind: string): kind is PromptKind => kind in HANDLERS

export const terminalAnswers =
  (prompt: Prompt): PromptHandler =>
  async (request: PromptRequest) => {
    if (!isPromptKind(request.kind)) throw declined()
    const handler = HANDLERS[request.kind] as (
      prompt: Prompt,
      data: unknown
    ) => Promise<unknown>

    return handler(prompt, request.data)
  }
