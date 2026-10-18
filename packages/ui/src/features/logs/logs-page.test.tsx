// Manage → Logs end to end: the fake Engine's log buffer over the rpc memory transport, searched and filtered on
// the Engine's side, new lines pushed live.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { t } from '@ui/__tests__/test-i18n.ts'
import { renderApp } from '@ui/__tests__/test-services.tsx'
import { FAKE_IPAD, fakeDevices } from '@ui/services/engine/fake/fake-data.ts'
import { createFakeDeviceFeed } from '@ui/services/engine/fake/fake-devices.ts'

// The test DOM has no layout: give the list a viewport and each row a height, as a browser would, so the virtual
// list renders the rows in view.
const LIST_HEIGHT = 600
const ROW_HEIGHT = 30
const LIST_WIDTH = 800

const sizeOf = (element: HTMLElement) =>
  element.getAttribute('role') === 'log' ? LIST_HEIGHT : ROW_HEIGHT
const sizes = {
  offsetHeight: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight'
  ),
  offsetWidth: Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetWidth'
  )
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return sizeOf(this)
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => LIST_WIDTH
  })
})

afterAll(() => {
  for (const [name, descriptor] of Object.entries(sizes))
    if (descriptor)
      Object.defineProperty(HTMLElement.prototype, name, descriptor)
})

const logList = () => screen.findByRole('log', { name: t('logs.list.label') })

const lineButtons = async () =>
  within(await logList()).queryAllByRole('button', { expanded: false })

const messages = async () =>
  (await lineButtons()).map((line) => line.textContent ?? '')

describe('the Logs page', () => {
  it("shows the Engine's lines, newest last, each opening its details", async () => {
    const user = userEvent.setup()
    await renderApp('/logs')

    await waitFor(async () => expect(await messages()).toHaveLength(3))
    const [, , anisette] = await lineButtons()
    expect(anisette?.textContent).toContain('anisette server picked')
    expect(anisette?.textContent).toContain(t('logs.area.apple'))
    await user.click(anisette as HTMLElement)
    const details = within(await logList()).getByRole('button', {
      name: t('logs.row.copy')
    }).parentElement as HTMLElement
    expect(details.textContent).toContain('ani.example.net')
  })

  it('searches in the Engine and marks what matched', async () => {
    const user = userEvent.setup()
    await renderApp('/logs')
    await waitFor(async () => expect(await messages()).toHaveLength(3))

    await user.type(
      screen.getByRole('searchbox', { name: t('logs.search.label') }),
      'ANISETTE'
    )
    await waitFor(async () => expect(await messages()).toHaveLength(1))
    expect(within(await logList()).getByText('anisette').tagName).toBe('MARK')
    expect(
      screen.getByRole('button', {
        name: t('logs.filters.remove', {
          filter: t('logs.filters.text', { text: 'ANISETTE' })
        })
      })
    ).toBeDefined()
  })

  it('narrows by level and area, and says when nothing matches', async () => {
    const user = userEvent.setup()
    await renderApp('/logs')
    await waitFor(async () => expect(await messages()).toHaveLength(3))

    await user.click(screen.getByRole('radio', { name: /^Errors/ }))
    expect(await screen.findByText(t('logs.empty.noMatch.title'))).toBeDefined()
    await user.click(
      screen.getByRole('button', { name: t('logs.empty.noMatch.showAll') })
    )
    await waitFor(async () => expect(await messages()).toHaveLength(3))
  })

  it('adds new lines as the Engine pushes them', async () => {
    const devices = createFakeDeviceFeed(false, [])
    await renderApp('/logs', { devices })
    await waitFor(async () => expect(await messages()).toHaveLength(3))

    const ipad = fakeDevices.find((device) => device.udid === FAKE_IPAD)
    if (!ipad) throw new Error('the fake data has an iPad')
    act(() => devices.plugIn(ipad))
    await waitFor(async () =>
      expect((await messages()).at(-1)).toContain('device attached')
    )
  })

  it('copies the lines shown after saying how many, and saves every line to a file', async () => {
    const user = userEvent.setup()
    const { clipboard, files } = await renderApp('/logs')
    await waitFor(async () => expect(await messages()).toHaveLength(3))

    await user.click(screen.getByRole('button', { name: t('logs.copy') }))
    const copy = await screen.findByRole('alertdialog', {
      name: t('logs.export.copyTitle', { count: 3 })
    })
    await user.click(
      within(copy).getByRole('button', { name: t('logs.export.confirmCopy') })
    )
    await waitFor(() => expect(clipboard.written).toHaveLength(1))
    const lines = clipboard.written[0]?.split('\n') ?? []
    expect(lines).toHaveLength(3)
    expect(lines[2]).toMatch(/Z INFO {2}apple anisette server picked \{/)

    await user.click(screen.getByRole('button', { name: t('logs.save') }))
    const save = await screen.findByRole('alertdialog')
    await user.click(
      within(save).getByRole('button', { name: t('logs.export.confirmSave') })
    )
    await waitFor(() => expect(files.saved).toHaveLength(1))
    expect(files.saved[0]?.name).toMatch(
      /^ipaforge-logs-\d{4}-\d\d-\d\d-\d{4}\.log$/
    )
  })

  it('clears the view without losing what Save writes', async () => {
    const user = userEvent.setup()
    await renderApp('/logs')
    await waitFor(async () => expect(await messages()).toHaveLength(3))

    await user.click(screen.getByRole('button', { name: t('logs.clear') }))
    expect(await screen.findByText(t('logs.empty.cleared.title'))).toBeDefined()
  })

  it('switches debug details on in the Engine', async () => {
    const user = userEvent.setup()
    await renderApp('/logs')
    const debug = await screen.findByRole('switch', { name: t('logs.debug') })
    await waitFor(() => expect(debug.hasAttribute('disabled')).toBe(false))

    await user.click(debug)
    await waitFor(() => expect((debug as HTMLInputElement).checked).toBe(true))
  })
})

describe('Show logs', () => {
  it("opens Logs with only a failed run's lines", async () => {
    const user = userEvent.setup()
    const { history } = await renderApp('/install', {
      scenario: 'device-locked'
    })
    const install = await screen.findByRole('button', {
      name: t('install.home.install', { app: 'SideStore' })
    })
    await waitFor(() => expect(install.hasAttribute('disabled')).toBe(false))
    await user.click(install)
    const box = await screen.findByRole('alert')

    await user.click(
      within(box).getByRole('button', { name: t('install.failed.showLogs') })
    )
    await waitFor(() => expect(history.location.pathname).toBe('/logs'))
    expect(
      await screen.findByText(t('logs.filters.showing'), { exact: false })
    ).toBeDefined()
    await waitFor(async () =>
      expect((await messages()).join('\n')).toContain('run failed')
    )
    expect((await messages()).join('\n')).not.toContain('anisette')
  })
})

describe('Ctrl+L', () => {
  it('opens Logs from any section and goes back from Logs', async () => {
    const user = userEvent.setup()
    const { history } = await renderApp('/devices')

    await user.keyboard('{Control>}l{/Control}')
    await waitFor(() => expect(history.location.pathname).toBe('/logs'))
    await user.keyboard('{Control>}l{/Control}')
    await waitFor(() => expect(history.location.pathname).toBe('/devices'))
  })
})
