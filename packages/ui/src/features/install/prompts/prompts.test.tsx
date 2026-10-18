// The run's question dialogs on their own: what each one shows, what it answers, and its busy state.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { renderInApp } from '@ui/__tests__/hook-wrapper.tsx'
import { t } from '@ui/__tests__/test-i18n.ts'
import { PromptFor } from '@ui/features/install/prompts/components/prompt-for.tsx'
import { certificateOrigin } from '@ui/features/install/prompts/utils/certificate-origin.ts'

const actions = () => ({
  onAnswer: vi.fn(),
  onDecline: vi.fn(),
  declineLabelKey: 'install.run.cancelInstall' as const
})

const PAIRING_APPS = [
  { bundleId: 'com.SideStore.SideStore', appName: 'SideStore' },
  { bundleId: 'com.kdt.livecontainer', appName: 'LiveContainer' },
  { bundleId: 'org.example.other', appName: 'Other' }
]

describe('certificateOrigin', () => {
  it('tells IPAForge’s, SideStore’s and AltStore’s from a named computer and an unnamed one', () => {
    const origin = (machineName: string) =>
      certificateOrigin({ serialNumber: '1', machineName })
    expect(origin('IPAForge')).toBe('ipaforge')
    expect(origin('SideStore')).toBe('sidestore')
    expect(origin('AltStore')).toBe('sidestore')
    expect(origin('MacBook Pro')).toBe('machine')
    expect(origin('')).toBe('unknown')
  })
})

describe('the run’s questions', () => {
  it('keeps the dialog busy after an answer until the Engine moves on', async () => {
    await renderInApp(
      <PromptFor
        request={{
          kind: 'apple.revoke_certificate',
          data: {
            certificates: [{ serialNumber: '1', machineName: 'SideStore' }]
          }
        }}
        isPending
        {...actions()}
      />
    )
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(t('prompts.revoke.revoking'))).toBeDefined()
    expect(
      within(dialog)
        .getByRole('button', { name: t('install.run.cancelInstall') })
        .hasAttribute('disabled')
    ).toBe(true)
  })

  it('shares the certificate only when asked to', async () => {
    const user = userEvent.setup()
    const props = actions()
    await renderInApp(
      <PromptFor
        request={{
          kind: 'installer.share_certificate',
          data: { appName: 'MyStore', bundleId: 'org.example.store' }
        }}
        isPending={false}
        {...props}
      />
    )
    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(t('prompts.share.no'))
      })
    )
    expect(props.onAnswer).toHaveBeenCalledWith(false)
  })

  it('ticks every app for the pairing file, counts them, and places it in the ones left ticked', async () => {
    const user = userEvent.setup()
    const props = actions()
    await renderInApp(
      <PromptFor
        request={{
          kind: 'device.choose_pairing_apps',
          data: { apps: PAIRING_APPS }
        }}
        isPending={false}
        {...props}
      />
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(t('prompts.pairing.purpose.sidestore'))
    ).toBeDefined()
    expect(within(dialog).getByText('org.example.other')).toBeDefined()

    await user.click(within(dialog).getByRole('checkbox', { name: /Other/ }))
    await user.click(
      within(dialog).getByRole('button', {
        name: t('prompts.pairing.place', { count: 2 })
      })
    )
    expect(props.onAnswer).toHaveBeenCalledWith([
      'com.SideStore.SideStore',
      'com.kdt.livecontainer'
    ])
  })

  it('can’t place the pairing file in no app', async () => {
    const user = userEvent.setup()
    await renderInApp(
      <PromptFor
        request={{
          kind: 'device.choose_pairing_apps',
          data: { apps: PAIRING_APPS }
        }}
        isPending={false}
        {...actions()}
      />
    )
    const dialog = await screen.findByRole('dialog')
    await user.click(
      within(dialog).getByRole('button', {
        name: t('prompts.pairing.clearAll')
      })
    )
    expect(
      within(dialog)
        .getByRole('button', { name: t('prompts.pairing.place', { count: 0 }) })
        .hasAttribute('disabled')
    ).toBe(true)
  })

  it('offers to cancel a question this version doesn’t know', async () => {
    await renderInApp(
      <PromptFor
        request={{ kind: 'future.question', data: {} } as never}
        isPending={false}
        {...actions()}
      />
    )
    expect(
      await screen.findByText(t('install.run.unsupportedPrompt.body'))
    ).toBeDefined()
  })
})
