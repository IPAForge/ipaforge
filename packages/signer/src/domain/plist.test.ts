import { execFileSync } from 'node:child_process'

import { describe, expect, it } from 'vitest'

import {
  createDict,
  ErrorCode,
  IPAForgeError,
  isBinaryPlist,
  type PlistDict,
  PlistReal,
  parseBinaryPlist,
  parsePlist,
  parseXmlPlist,
  real,
  serializeXmlPlist,
  utf8Decode,
  utf8Encode
} from '@ipaforge/kernel'
import { readFixture } from '@signer/__tests__/fixtures.ts'

const isMac = process.platform === 'darwin'
const plutilXml = (bytes: Uint8Array): string =>
  execFileSync('plutil', ['-convert', 'xml1', '-o', '-', '-'], {
    input: bytes
  }).toString('utf8')

describe('XML round-trip with CoreFoundation formatting', () => {
  it.each(['app.plist', 'appex.plist', 'resign.plist'])(
    'entitlements/%s re-serializes byte-identically',
    (name) => {
      const bytes = readFixture('entitlements', name)
      expect(utf8Decode(serializeXmlPlist(parseXmlPlist(bytes)))).toBe(
        utf8Decode(bytes)
      )
    }
  )

  it('keeps integers and reals distinct', () => {
    const value = parseXmlPlist(
      '<plist><dict><key>i</key><integer>1</integer><key>r</key><real>1.0</real><key>big</key><integer>9007199254740993</integer><key>neg</key><integer>-5</integer></dict></plist>'
    ) as PlistDict
    expect(value.i).toBe(1)
    expect(value.r).toBeInstanceOf(PlistReal)
    expect((value.r as PlistReal).value).toBe(1)
    expect(value.big).toBe(9007199254740993n)
    expect(value.neg).toBe(-5)
    expect(utf8Decode(serializeXmlPlist(value))).toContain('<real>1</real>')
  })

  it('decodes entities, CDATA and keeps string whitespace', () => {
    const value = parseXmlPlist(
      '<plist><array><string>  a &amp; b &lt;c&gt; &#x263A; &#65;</string><string><![CDATA[<raw>]]></string><string/></array></plist>'
    )
    expect(value).toEqual(['  a & b <c> ☺ A', '<raw>', ''])
  })

  it('writes data with depth-dependent line width', () => {
    const data = new Uint8Array(100).map((_, i) => i)
    const xml = utf8Decode(serializeXmlPlist(createDict([['blob', data]])))
    // values of the root dict are at depth 1 → one tab, 76 − 8·1 = 68 base64 characters per line
    const lines = xml
      .split('\n')
      .filter((line) => /^\t[A-Za-z0-9+/=]+$/.test(line))
    expect(lines[0]?.trim()).toHaveLength(68)
    expect(parseXmlPlist(xml)).toEqual(createDict([['blob', data]]))
  })

  it('never lets __proto__ keys pollute prototypes', () => {
    const value = parseXmlPlist(
      '<plist><dict><key>__proto__</key><dict><key>polluted</key><true/></dict></dict></plist>'
    )
    expect(Object.keys(value as PlistDict)).toEqual(['__proto__'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it.each([
    ['no root element', 'just text'],
    ['bad integer', '<plist><integer>x</integer></plist>'],
    ['unknown element', '<plist><foo/></plist>'],
    ['unterminated', '<plist><dict><key>a</key>'],
    ['trailing content', '<plist><true/></plist><plist/>'],
    ['unknown entity', '<plist><string>&nope;</string></plist>']
  ])('rejects %s', (_label, xml) => {
    expect(() => parseXmlPlist(xml)).toThrow(IPAForgeError)
    try {
      parseXmlPlist(xml)
    } catch (error) {
      expect((error as IPAForgeError).code).toBe(ErrorCode.InvalidPlist)
    }
  })
})

describe('binary plists', () => {
  const binaryInfo = readFixture('inputs', 'Test.app', 'Info.plist')
  const sourceInfo = readFixture('src', 'bundle', 'Info.plist')

  it("detects and parses the fixture's binary Info.plist like its XML source", () => {
    expect(isBinaryPlist(binaryInfo)).toBe(true)
    expect(isBinaryPlist(sourceInfo)).toBe(false)
    const fromBinary = parseBinaryPlist(binaryInfo) as PlistDict
    expect(fromBinary).toEqual(parseXmlPlist(sourceInfo))
    expect(fromBinary.UIBackgroundRefreshInterval).toEqual(real(3600.5))
    expect(parsePlist(binaryInfo)).toEqual(fromBinary)
  })

  it.skipIf(!isMac)('serializes exactly like plutil (macOS)', () => {
    expect(utf8Decode(serializeXmlPlist(parseBinaryPlist(binaryInfo)))).toBe(
      plutilXml(binaryInfo)
    )
  })

  it.skipIf(!isMac)(
    "round-trips every value type through plutil's binary encoder (macOS)",
    () => {
      const value = createDict([
        ['string', 'héllo ✓ 👋'],
        ['ascii', 'plain'],
        ['int', 42],
        ['negative', -7],
        ['large', 2 ** 40],
        ['big', 9007199254740993n],
        ['real', real(0.1)],
        ['tiny', real(1e-5)],
        ['huge', real(1.5e300)],
        ['negativeReal', real(-2.5)],
        ['third', real(1 / 3)],
        ['integralReal', real(1000)],
        ['bool', true],
        ['data', new Uint8Array([0, 1, 2, 250])],
        ['date', new Date('2026-10-13T12:00:00Z')],
        ['array', ['a', 1, [true]]],
        ['empty', createDict()],
        ['long', 'x'.repeat(300)]
      ])
      const xml = serializeXmlPlist(value)
      const binary = new Uint8Array(
        execFileSync('plutil', ['-convert', 'binary1', '-o', '-', '-'], {
          input: xml
        })
      )
      expect(parseBinaryPlist(binary)).toEqual(value)
      expect(utf8Decode(serializeXmlPlist(value))).toBe(plutilXml(xml))
    }
  )

  it('rejects corrupt binary plists', () => {
    const corrupt = binaryInfo.slice()
    corrupt.fill(0xff, corrupt.length - 8) // offset table offset → nonsense
    expect(() => parseBinaryPlist(corrupt)).toThrow(IPAForgeError)
    expect(() => parseBinaryPlist(utf8Encode('bplist00'))).toThrow(
      IPAForgeError
    )
  })
})
