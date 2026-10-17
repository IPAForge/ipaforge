import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js'
import { afterAll, describe, expect, it } from 'vitest'

import {
  bytesFileSource,
  concatBytes,
  ErrorCode,
  LoadstarError,
  silentLogger,
  toHex,
  utf8Encode
} from '@loadstar/kernel'
import { FIXTURES_DIR, readTree } from '@signer/__tests__/fixtures.ts'
import type { BundleTree } from '@signer/domain/bundle/types.ts'
import {
  assertSafePath,
  type Ipa,
  readIpa,
  writeIpa
} from '@signer/infrastructure/ipa/index.ts'

const isMac = process.platform === 'darwin'
const temp = mkdtempSync(join(tmpdir(), 'loadstar-ipa-'))
afterAll(() => rmSync(temp, { recursive: true, force: true }))
const logger = silentLogger

const collect = async (
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array> => {
  const chunks: Uint8Array[] = []
  for await (const chunk of stream) chunks.push(chunk)
  return concatBytes(chunks)
}

const fixtureApp = (): BundleTree =>
  new Map(
    readTree(join(FIXTURES_DIR, 'expected/Test.app')).map((e) => [
      e.path,
      e.kind === 'symlink'
        ? { kind: 'symlink' as const, target: e.target ?? '', mode: 0o755 }
        : {
            kind: 'file' as const,
            data: e.data ?? new Uint8Array(),
            mode: e.mode
          }
    ])
  )

/** Minimal stored (uncompressed) zip, built by hand so it can contain names zip.js refuses to write. */
const rawZip = (entries: readonly [string, Uint8Array][]): Uint8Array => {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc32 = (data: Uint8Array): number => {
    let c = 0xffffffff
    for (const byte of data)
      c = (crcTable[(c ^ byte) & 0xff] as number) ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, data] of entries) {
    const nameBytes = utf8Encode(name)
    const header = new DataView(new ArrayBuffer(30))
    header.setUint32(0, 0x04034b50, true)
    header.setUint16(4, 20, true)
    header.setUint32(14, crc32(data), true)
    header.setUint32(18, data.length, true)
    header.setUint32(22, data.length, true)
    header.setUint16(26, nameBytes.length, true)
    const local = concatBytes([new Uint8Array(header.buffer), nameBytes, data])
    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint32(16, crc32(data), true)
    central.setUint32(20, data.length, true)
    central.setUint32(24, data.length, true)
    central.setUint16(28, nameBytes.length, true)
    central.setUint32(42, offset, true)
    centrals.push(concatBytes([new Uint8Array(central.buffer), nameBytes]))
    locals.push(local)
    offset += local.length
  }
  const directory = concatBytes(centrals)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, entries.length, true)
  end.setUint16(10, entries.length, true)
  end.setUint32(12, directory.length, true)
  end.setUint32(16, offset, true)
  return concatBytes([...locals, directory, new Uint8Array(end.buffer)])
}

const zipOf = async (
  entries: readonly [string, Uint8Array][]
): Promise<Uint8Array> => {
  const writer = new ZipWriter(new Uint8ArrayWriter())
  for (const [name, data] of entries)
    await writer.add(name, new Uint8ArrayReader(data))
  return writer.close()
}

describe('IPA round trip', () => {
  it('preserves every file, executable bit and symlink', async () => {
    const app = fixtureApp()
    const ipa: Ipa = {
      appName: 'Test.app',
      app,
      extras: new Map([
        [
          'SwiftSupport/x.txt',
          { kind: 'file', data: utf8Encode('x'), mode: 0o644 }
        ]
      ])
    }
    const bytes = await collect(writeIpa(ipa, { logger }))
    const back = await readIpa(bytesFileSource('Test.ipa', bytes), { logger })

    expect(back.appName).toBe('Test.app')
    expect([...back.app.keys()].sort()).toEqual([...app.keys()].sort())
    for (const [path, entry] of app) {
      const read = back.app.get(path)
      if (entry.kind === 'symlink')
        expect(read).toEqual({
          kind: 'symlink',
          target: entry.target,
          mode: 0o755
        })
      else
        expect({
          path,
          mode: read?.mode,
          hex: read?.kind === 'file' ? toHex(read.data) : ''
        }).toEqual({
          path,
          mode: entry.mode,
          hex: toHex(entry.data)
        })
    }
    expect(back.app.get('Test')?.mode).toBe(0o755)
    expect([...back.extras.keys()]).toEqual(['SwiftSupport/x.txt'])
  })

  it('is deterministic', async () => {
    const ipa: Ipa = {
      appName: 'Test.app',
      app: fixtureApp(),
      extras: new Map()
    }
    const [a, b] = await Promise.all([
      collect(writeIpa(ipa, { logger })),
      collect(writeIpa(ipa, { logger }))
    ])
    expect(toHex(a ?? new Uint8Array())).toBe(toHex(b ?? new Uint8Array()))
  })

  it.skipIf(!isMac)(
    "produces an archive that macOS extracts with Apple's signature still valid",
    async () => {
      const path = join(temp, 'Test.ipa')
      writeFileSync(
        path,
        await collect(
          writeIpa(
            { appName: 'Test.app', app: fixtureApp(), extras: new Map() },
            { logger }
          )
        )
      )
      const out = join(temp, 'extracted')
      execFileSync('ditto', ['-x', '-k', path, out])
      execFileSync(
        'codesign',
        ['--verify', '--deep', '--strict', join(out, 'Payload/Test.app')],
        { stdio: 'pipe' }
      )
      const zipinfo = execFileSync('zipinfo', [path], { encoding: 'utf8' })
      expect(zipinfo).toMatch(/^l.* Payload\/Test\.app\/Strings-link$/m)
      expect(zipinfo).toMatch(/^-rwxr-xr-x.* Payload\/Test\.app\/Test$/m)
    }
  )

  it.skipIf(!isMac)('reads an IPA produced by macOS ditto', async () => {
    const path = join(temp, 'ditto.ipa')
    execFileSync('ditto', [
      '-c',
      '-k',
      '--sequesterRsrc',
      '--keepParent',
      join(FIXTURES_DIR, 'expected/Test.app'),
      join(temp, 'Test.zip')
    ])
    // ditto keeps the parent dir; wrap it as an IPA (Payload/Test.app/…)
    const plain = await readIpa(
      bytesFileSource(
        'x',
        new Uint8Array(readFileSync(join(temp, 'Test.zip')))
      ),
      {
        logger
      }
    ).catch((e) => e)
    expect(plain).toBeInstanceOf(LoadstarError) // no Payload/ → refused
    execFileSync('mkdir', ['-p', join(temp, 'dittoroot/Payload')])
    execFileSync('cp', [
      '-R',
      join(FIXTURES_DIR, 'expected/Test.app'),
      join(temp, 'dittoroot/Payload/')
    ])
    execFileSync('ditto', [
      '-c',
      '-k',
      '--norsrc',
      join(temp, 'dittoroot'),
      path
    ])
    const ipa = await readIpa(
      bytesFileSource('ditto.ipa', new Uint8Array(readFileSync(path))),
      { logger }
    )
    expect(ipa.app.get('Strings-link')).toEqual({
      kind: 'symlink',
      target: 'en.lproj/Localizable.strings',
      mode: 0o755
    })
    expect(ipa.app.get('Test')?.mode).toBe(0o755)
    expect(ipa.app.size).toBe(fixtureApp().size)
  })
})

describe('IPA safety', () => {
  it.each([
    'Payload/../../evil',
    '/etc/passwd',
    'Payload\\..\\x',
    'C:/Windows/x',
    'Payload/A.app/../../x'
  ])('rejects %s', (name) => {
    expect(() => assertSafePath(name)).toThrow(LoadstarError)
  })

  it('rejects archives containing a zip-slip entry', async () => {
    for (const evil of [
      'Payload/A.app/../../evil',
      '/abs/path',
      'Payload\\..\\win'
    ]) {
      const zip = rawZip([
        ['Payload/A.app/Info.plist', utf8Encode('x')],
        [evil, utf8Encode('x')]
      ])
      await expect(
        readIpa(bytesFileSource('a.ipa', zip), { logger })
      ).rejects.toMatchObject({
        code: ErrorCode.ZipSlip
      })
    }
  })

  it('requires exactly one app', async () => {
    const none = await zipOf([['readme.txt', utf8Encode('x')]])
    const two = await zipOf([
      ['Payload/A.app/x', utf8Encode('x')],
      ['Payload/B.app/x', utf8Encode('x')]
    ])
    await expect(
      readIpa(bytesFileSource('n.ipa', none), { logger })
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidBundle
    })
    await expect(
      readIpa(bytesFileSource('t.ipa', two), { logger })
    ).rejects.toMatchObject({
      code: ErrorCode.InvalidBundle
    })
  })

  it('enforces size and entry limits', async () => {
    const zip = await zipOf([
      ['Payload/A.app/big', new Uint8Array(1024 * 1024)]
    ])
    await expect(
      readIpa(bytesFileSource('b.ipa', zip), {
        logger,
        limits: { maxEntries: 10, maxUncompressedBytes: 1000 }
      })
    ).rejects.toMatchObject({ code: ErrorCode.InvalidBundle })
  })

  it('drops iTunesMetadata.plist and __MACOSX', async () => {
    const zip = await zipOf([
      ['Payload/A.app/Info.plist', utf8Encode('x')],
      ['iTunesMetadata.plist', utf8Encode('apple-id')],
      ['__MACOSX/._A.app', utf8Encode('rsrc')]
    ])
    const ipa = await readIpa(bytesFileSource('m.ipa', zip), { logger })
    expect(ipa.extras.size).toBe(0)
  })
})

describe.skipIf(!process.env.LOADSTAR_BENCH)(
  'IPA memory (LOADSTAR_BENCH=1)',
  () => {
    const MB = 1024 * 1024
    const peakDuring = async <T>(
      work: () => Promise<T>
    ): Promise<{ result: T; peakMb: number }> => {
      const baseline = process.memoryUsage().rss
      let peak = baseline
      const timer = setInterval(() => {
        peak = Math.max(peak, process.memoryUsage().rss)
      }, 10)
      const result = await work()
      clearInterval(timer)
      return {
        result,
        peakMb: (Math.max(peak, process.memoryUsage().rss) - baseline) / MB
      }
    }

    it('streams a 300 MB app out with bounded writer overhead', async () => {
      const app: BundleTree = new Map([
        ['Info.plist', { kind: 'file', data: utf8Encode('x'), mode: 0o644 }]
      ])
      for (let i = 0; i < 30; i++) {
        const data = new Uint8Array(10 * MB)
        for (let j = 0; j < data.length; j += 65536)
          crypto.getRandomValues(data.subarray(j, j + 65536))
        app.set(`Assets/blob-${i}.bin`, { kind: 'file', data, mode: 0o644 })
      }
      // The 300 MB input already exists; a discarding sink means any growth is the writer's own buffering.
      const write = await peakDuring(async () => {
        let total = 0
        for await (const chunk of writeIpa(
          { appName: 'Big.app', app, extras: new Map() },
          { logger, level: 0 }
        )) {
          total += chunk.byteLength
        }
        return total
      })
      console.info(
        `[bench] wrote ${(write.result / MB).toFixed(0)} MB archive; writer overhead peak ${write.peakMb.toFixed(0)} MB`
      )
      expect(write.result).toBeGreaterThan(300 * MB)
      expect(write.peakMb).toBeLessThan(150)
    }, 120_000)
  }
)
