// What each step says it did, after a run against the fake Engine.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

const APP = 'SideStore'

const install = async (scenario?: FakeScenarioId) => {
  const user = userEvent.setup()
  await renderApp('/install', scenario ? { scenario } : {})
  const button = await screen.findByRole('button', {
    name: t('install.home.install', { app: APP })
  })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  await user.click(button)
  return user
}

const finished = () =>
  screen.findByRole('heading', {
    level: 1,
    name: t('install.run.title.completed', { app: APP })
  })

const stepText = (labelKey: string) => {
  const steps = screen.getByRole('list', { name: t('install.run.steps') })
  const row = within(steps)
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(t(labelKey as never)))

  return row?.textContent ?? ''
}

describe('step reports', () => {
  it('says what every step did', async () => {
    await install()
    await finished()

    expect(stepText('install.steps.device')).toContain(
      'iPhone 16 Pro · iOS 26.1'
    )
    expect(stepText('install.steps.resolve')).toContain(
      t('install.run.report.release', {
        app: 'SideStore',
        version: '0.7.0',
        channel: t('install.channel.stable')
      })
    )
    expect(stepText('install.steps.download')).toContain(
      t('install.run.report.download', { size: '28 MB' })
    )
    expect(stepText('install.steps.sign_in')).toContain(
      t('install.run.report.session.reused')
    )
    expect(stepText('install.steps.team')).toContain(
      t('accounts.freeTeam', { name: 'Personal team' })
    )
    expect(stepText('install.steps.register_device')).toContain(
      t('install.run.report.alreadyRegistered')
    )
    expect(stepText('install.steps.certificate')).toContain(
      t('install.run.report.certificate.reused')
    )
    expect(stepText('install.steps.app_ids')).toContain(
      t('install.plan.appIdsValue', { created: 2, reused: 0, left: 6 })
    )
    expect(stepText('install.steps.free_apps')).toContain(
      t('install.plan.freeAppsValue', { used: 1, limit: 3 })
    )
    expect(stepText('install.steps.pairing')).toContain(
      t('install.run.report.pairing', { apps: 'SideStore' })
    )
  })

  it('says a certificate was replaced after one was revoked', async () => {
    const user = await install('certificate-limit')
    const dialog = await screen.findByRole('dialog', {
      name: t('prompts.revoke.title')
    })
    const [first] = within(dialog).getAllByRole('radio')
    await user.click(first as HTMLElement)
    await user.click(
      within(dialog).getByRole('button', { name: t('prompts.revoke.confirm') })
    )
    await finished()
    expect(stepText('install.steps.certificate')).toContain(
      t('install.run.report.certificate.replaced')
    )
  })
})
