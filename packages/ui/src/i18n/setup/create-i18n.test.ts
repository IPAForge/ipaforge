import { describe, expect, it } from 'vitest'

import { createLogger, type LogRecord } from '@ipaforge/kernel'
import { createTestI18n } from '@ui/__tests__/test-i18n.ts'
import { createI18n } from '@ui/i18n/setup/create-i18n.ts'

const DEVICES = 'devices.engine.connected'

const withRecords = () => {
  const records: LogRecord[] = []
  const logger = createLogger({
    level: 'debug',
    sink: (record) => records.push(record)
  })

  return { records, i18n: createI18n({ logger, warnOnMissingKeys: true }) }
}

describe('createI18n', () => {
  it('is ready on creation with the requested language', async () => {
    const i18n = await createTestI18n('de')
    expect(i18n.language).toBe('de')
    expect(i18n.t('nav.settings')).toBe('Einstellungen')
  })

  it("formats ICU plurals with each language's plural rules", async () => {
    const en = await createTestI18n('en')
    expect([0, 1, 5].map((count) => en.t(DEVICES, { count }))).toEqual([
      'Engine connected · no devices',
      'Engine connected · 1 device',
      'Engine connected · 5 devices'
    ])
    const ru = await createTestI18n('ru')
    const [one, few, many] = [1, 3, 5].map((count) => ru.t(DEVICES, { count }))
    expect(new Set([one, few, many]).size).toBe(3)
    expect(few).toContain('3 ')
  })

  it('fills ICU arguments', async () => {
    expect(
      (await createTestI18n()).t('settings.language.system', {
        language: 'Deutsch'
      })
    ).toBe('System (Deutsch)')
  })

  it('falls back to English for an untranslated (empty) message', async () => {
    const i18n = await createTestI18n('ja')
    i18n.addResource('ja', 'translation', 'nav.logs', '')
    expect(i18n.t('nav.logs')).toBe('Logs')
  })

  it('warns about a missing key and logs language changes', async () => {
    const { records, i18n } = withRecords()
    i18n.t('nav.nowhere' as 'nav.logs')
    await i18n.changeLanguage('ar')
    expect(records).toContainEqual(
      expect.objectContaining({
        level: 'warn',
        msg: 'missing translation',
        fields: expect.objectContaining({ messageKey: 'nav.nowhere' })
      })
    )
    expect(records).toContainEqual(
      expect.objectContaining({
        level: 'info',
        msg: 'language changed',
        fields: { locale: 'ar' }
      })
    )
  })

  it('offers the pseudo-locale in dev, built from English', async () => {
    expect((await createTestI18n('en-XA')).t('nav.install')).toBe(
      '[Îñšţåļļ~~~]'
    )
  })
})
