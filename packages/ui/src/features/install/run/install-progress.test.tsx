// The detail an install shows while it runs, and how it says the device is connected: a running step's bar with its
// numbers, the device line (USB or Wi-Fi), the Wi-Fi notice while installing, and signing compressed over Wi-Fi.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderInApp } from '@ui/__tests__/hook-wrapper.tsx'
import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { StepLive } from '@ui/features/install/run/components/step-live.tsx'
import type { FakeScenarioId } from '@ui/services/engine/fake/types.ts'

const APP = 'SideStore'
const MB = 1_000_000

const install = async (scenario: FakeScenarioId) => {
  const user = userEvent.setup()

  await renderApp('/install', { scenario })

  const button = await screen.findByRole('button', {
    name: t('install.home.install', { app: APP })
  })

  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  await user.click(button)
}

const finished = () =>
  screen.findByRole('heading', {
    level: 1,
    name: t('install.run.title.completed', { app: APP })
  })

const stepText = (labelKey: string) =>
  within(screen.getByRole('list', { name: t('install.run.steps') }))
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(t(labelKey as never)))
    ?.textContent ?? ''

describe('a running step', () => {
  it('shows the bytes sent, the speed and the time left', async () => {
    await renderInApp(
      <StepLive
        label={t('install.steps.install')}
        progress={{
          percent: 25,
          bytes: { received: 30 * MB, total: 120 * MB },
          bytesPerSecond: 3 * MB,
          secondsLeft: 30
        }}
      />
    )

    expect(
      screen.getByRole('progressbar', { name: t('install.steps.install') })
    ).toBeDefined()
    expect(
      screen.getByText(
        t('install.run.detail.bytes', { received: '30 MB', total: '120 MB' })
      )
    ).toBeDefined()
    expect(
      screen.getByText(
        new RegExp(
          `/s · ${t('install.run.live.leftSeconds', { seconds: 30 })}$`
        )
      )
    ).toBeDefined()
  })

  it("shows iOS's own percent and phase while it installs", async () => {
    await renderInApp(
      <StepLive
        label={t('install.steps.install')}
        progress={{ percent: 40, phase: 'checking', secondsLeft: 90 }}
      />
    )

    expect(
      screen.getByText(
        t('install.run.live.installing', {
          fraction: 0.4,
          phase: t('install.run.live.phase.checking')
        })
      )
    ).toBeDefined()
    expect(
      screen.getByText(new RegExp(t('install.run.live.ios')))
    ).toBeDefined()
  })
})

describe('the connection', () => {
  it('says the device is on USB, with no Wi-Fi notice, and signs uncompressed', async () => {
    await install('happy')
    await finished()

    expect(stepText('install.steps.device')).toContain(
      t('install.run.connection.usb')
    )
    expect(stepText('install.steps.sign')).not.toContain(
      t('install.run.report.signedCompressed', { count: 3 })
    )
    expect(screen.queryByText(t('install.run.wifi.title'))).toBeNull()
  })

  it('over Wi-Fi: says so, suggests a cable while installing, and signs compressed', async () => {
    await install('wifi')

    expect(await screen.findByText(t('install.run.wifi.title'))).toBeDefined()
    await finished()
    expect(stepText('install.steps.device')).toContain(
      t('install.run.connection.network')
    )
    expect(stepText('install.steps.sign')).toContain(
      t('install.run.report.signedCompressed', { count: 3 })
    )
    expect(screen.queryByText(t('install.run.wifi.title'))).toBeNull()
  })
})
