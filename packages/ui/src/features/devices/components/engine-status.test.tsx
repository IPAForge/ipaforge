import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ErrorCode, LoadstarError } from '@loadstar/kernel'
import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { createFakeEngineClient } from '@ui/services/engine/fake/fake-engine-client.ts'

describe('EngineStatus on the Devices page', () => {
  it('says the Engine is connected and how many devices it sees', async () => {
    await renderApp('/devices')
    expect(
      await screen.findByText(t('devices.engine.connected', { count: 2 }))
    ).toBeDefined()
  })

  it("says why the Engine can't be reached, from the error code", async () => {
    await renderApp('/devices', {
      engine: createFakeEngineClient({
        delayMs: 0,
        overrides: {
          listDevices: async () => {
            throw new LoadstarError(ErrorCode.UsbmuxdUnavailable)
          },
          // Like the Engine: without usbmuxd the feed has nothing to send.
          watchDevices: () => () => {}
        }
      })
    })
    expect(
      await screen.findByText(
        t('devices.engine.failed', {
          reason: t('errors.device.usbmuxd_unavailable.title')
        })
      )
    ).toBeDefined()
  })
})
