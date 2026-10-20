import { describe, expect, it } from 'vitest'

import { installKind } from '@desktop/main/updates/install-kind.ts'
import type { InstallProbe } from '@desktop/main/updates/types.ts'

const probe = (overrides: Partial<InstallProbe>): InstallProbe => ({
  platform: 'linux',
  appImage: undefined,
  resourcesPath: '/opt/IPAForge/resources',
  execPath: '/opt/IPAForge/ipaforge',
  productName: 'IPAForge',
  exists: () => false,
  readText: () => undefined,
  ...overrides
})

describe('installKind', () => {
  it('updates itself on macOS', () => {
    expect(installKind(probe({ platform: 'darwin' }))).toBe('self')
  })

  it('updates itself from the NSIS installer, whose uninstaller is next to it', () => {
    const execPath = String.raw`C:\Users\me\AppData\Local\Programs\IPAForge\IPAForge.exe`
    const seen: string[] = []
    const kind = installKind(
      probe({
        platform: 'win32',
        execPath,
        exists: (path) => {
          seen.push(path)
          return path.endsWith('Uninstall IPAForge.exe')
        }
      })
    )

    expect(kind).toBe('self')
    expect(seen).toHaveLength(1)
  })

  it('says a .msi copy cannot update itself', () => {
    expect(installKind(probe({ platform: 'win32' }))).toBe('msi')
  })

  it('updates itself as an AppImage', () => {
    expect(installKind(probe({ appImage: '/home/me/IPAForge.AppImage' }))).toBe(
      'self'
    )
  })

  it.each(['deb', 'rpm'] as const)(
    'reads a %s package from resources/package-type',
    (type) => {
      const kind = installKind(
        probe({
          // Any separator: the test also runs on Windows, where `join` uses backslashes.
          readText: (path) =>
            /resources[/\\]package-type$/.test(path) ? `${type}\n` : undefined
        })
      )

      expect(kind).toBe(type)
    }
  )

  it('calls any other Linux install another package', () => {
    expect(installKind(probe({ readText: () => 'pacman' }))).toBe('other')
    expect(installKind(probe({}))).toBe('other')
  })
})
