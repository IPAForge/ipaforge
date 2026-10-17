// The Install page end to end: the whole app over the rpc memory transport, with the fake Engine playing a
// scenario.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import type { TranslationKey } from '@ui/i18n/setup/i18next-types.ts'
import { createFakeDeviceFeed } from '@ui/services/engine/fake/fake-devices.ts'
import type { FakeScenarioId } from '@ui/services/engine/fake/fake-scenarios.ts'

const APP = 'SideStore'

const installButton = () =>
  screen.findByRole('button', { name: t('install.home.install', { app: APP }) })

const startInstall = async (scenario?: FakeScenarioId) => {
  const user = userEvent.setup()
  const rendered = await renderApp('/install', scenario ? { scenario } : {})
  const button = await installButton()
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  await user.click(button)
  return { user, ...rendered }
}

const findDialog = (titleKey: TranslationKey) =>
  screen.findByRole('dialog', { name: t(titleKey) })

const completedTitle = () =>
  screen.findByRole('heading', {
    level: 1,
    name: t('install.run.title.completed', { app: APP })
  })

const sidebarLink = (labelKey: 'nav.install' | 'nav.logs') =>
  within(screen.getByRole('navigation')).getByRole('link', {
    name: new RegExp(t(labelKey))
  })

describe('the install home', () => {
  it('shows what this install uses, from the Engine’s plan', async () => {
    await renderApp('/install')
    expect(
      await screen.findByText(
        t('install.plan.appIdsValue', { uses: 2, left: 8 })
      )
    ).toBeDefined()
    expect(
      screen.getByText(t('install.plan.freeAppsValue', { used: 1, limit: 3 }))
    ).toBeDefined()
    expect(screen.getByText(t('install.plan.certificateReused'))).toBeDefined()
  })

  it('waits for a device before Install can be pressed', async () => {
    await renderApp('/install', { devices: createFakeDeviceFeed(false, []) })
    const button = await installButton()
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByText(t('install.readiness.noDevice'))).toBeDefined()
  })
})

describe('installing SideStore', () => {
  it('runs every step and ends with what to do on the device', async () => {
    await startInstall()

    expect(await completedTitle()).toBeDefined()
    const steps = screen.getByRole('list', { name: t('install.run.steps') })
    const states = within(steps)
      .getAllByRole('listitem')
      .map((item) => item.dataset.state)
    expect(states).toHaveLength(15)
    expect(states.every((state) => state === 'done')).toBe(true)
    expect(
      screen.getByText(t('install.done.title', { app: APP, device: 'iPhone' }))
    ).toBeDefined()
  })

  it('asks for the password and the second factor during the run', async () => {
    const { user } = await startInstall('two-factor')

    const password = await findDialog('prompts.password.title')
    await user.type(
      within(password).getByLabelText(t('prompts.password.label'), {
        exact: false
      }),
      'secret'
    )
    await user.click(
      within(password).getByRole('button', { name: t('prompts.continue') })
    )
    const method = await findDialog('prompts.method.title')
    await user.click(
      within(method).getByRole('button', {
        name: new RegExp(t('prompts.method.trustedDevice'))
      })
    )
    const code = await findDialog('prompts.code.title')
    await user.type(within(code).getByRole('textbox'), '123456')
    await user.click(
      within(code).getByRole('button', { name: t('prompts.code.verify') })
    )

    expect(await completedTitle()).toBeDefined()
  })

  it('says what failed, copies diagnostics without secrets, and tries again from the checkpoint', async () => {
    const { user, clipboard } = await startInstall('device-locked')

    expect(
      await screen.findByText(t('errors.device.locked.title'))
    ).toBeDefined()
    await user.click(
      screen.getByRole('button', { name: t('install.failed.copy') })
    )
    await waitFor(() => expect(clipboard.written).toHaveLength(1))
    const [diagnostics] = clipboard.written
    expect(diagnostics).toContain('code: device.locked')
    expect(diagnostics).toContain('device: iPhone17,1, iOS 26.1')
    expect(diagnostics).not.toContain('example.com')

    await user.click(
      screen.getByRole('button', { name: t('install.failed.tryAgain') })
    )
    expect(await completedTitle()).toBeDefined()
  })

  it('says when a question can’t be asked yet, and cancelling stops the run where it was', async () => {
    const { user } = await startInstall('certificate-limit')
    const dialog = await findDialog('install.run.unsupportedPrompt.title')
    await user.click(
      within(dialog).getByRole('button', {
        name: t('install.run.cancelInstall')
      })
    )

    expect(
      await screen.findByText(
        t('install.cancelled.title', { step: t('install.steps.certificate') })
      )
    ).toBeDefined()
    expect(
      screen.getByRole('button', { name: t('install.cancelled.resume') })
    ).toBeDefined()
  })

  it('keeps going in other sections, with a badge on Install', async () => {
    const { user } = await startInstall('two-factor')
    expect(await screen.findByTestId('install-running')).toBeDefined()

    await user.click(sidebarLink('nav.logs'))
    expect(
      within(sidebarLink('nav.install')).getByText(t('nav.installRunning'))
    ).toBeDefined()
    // The run's question shows over any section.
    expect(await findDialog('prompts.password.title')).toBeDefined()
  })
})
