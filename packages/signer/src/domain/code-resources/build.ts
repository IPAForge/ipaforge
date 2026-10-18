import {
  createDict,
  type PlistValue,
  serializeXmlPlist
} from '@ipaforge/kernel'
import {
  CODE_RESOURCES,
  CODE_SIGNATURE_DIR,
  MAS_RECEIPT_DIR
} from '@signer/domain/bundle/layout.ts'
import {
  compileRules,
  matchRule,
  RULES_V1,
  RULES_V2,
  rulesToPlist
} from '@signer/domain/code-resources/rules.ts'
import type {
  CodeResourcesOptions,
  CodeResourcesResult,
  CompiledRule,
  ResourceEntry
} from '@signer/domain/code-resources/types.ts'
import type { Hasher } from '@signer/domain/ports/types.ts'

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Root-anchored exclusions that beat every rule (apple/bundlediskrep.cpp). */
const isExcluded = (path: string, mainExecutable: RegExp): boolean =>
  path === CODE_SIGNATURE_DIR ||
  path.startsWith(`${CODE_SIGNATURE_DIR}/`) ||
  path === CODE_RESOURCES ||
  path === MAS_RECEIPT_DIR ||
  path.startsWith(`${MAS_RECEIPT_DIR}/`) ||
  mainExecutable.test(path)

/** `files` (v1) value: regular files only, SHA-1; `undefined` when the entry is not listed. */
const sealV1 = async (
  entry: ResourceEntry,
  rule: CompiledRule | undefined,
  hasher: Hasher
): Promise<PlistValue | undefined> => {
  if (entry.kind !== 'file' || !rule || rule.omit) return undefined
  const sha1 = await hasher.digest('sha1', entry.data)
  if (!rule.optional) return sha1
  return createDict([
    ['hash', sha1],
    ['optional', true]
  ])
}

/** `files2` (v2) value: files and symlinks, with the optional flag when the rule sets it. */
const sealV2 = async (
  entry: ResourceEntry,
  rule: CompiledRule,
  hashMode: CodeResourcesOptions['hashMode'],
  hasher: Hasher
): Promise<PlistValue> => {
  const sealed: [string, PlistValue][] = []
  if (entry.kind === 'symlink') {
    sealed.push(['symlink', entry.target])
  } else {
    if (hashMode === 'dual')
      sealed.push(['hash', await hasher.digest('sha1', entry.data)])
    sealed.push(['hash2', await hasher.digest('sha256', entry.data)])
  }
  if (rule.optional) sealed.push(['optional', true])
  return createDict(sealed)
}

/** Builds `_CodeSignature/CodeResources` exactly as codesign does for an iOS (flat) bundle. */
export const buildCodeResources = async (
  entries: readonly ResourceEntry[],
  options: CodeResourcesOptions,
  hasher: Hasher
): Promise<CodeResourcesResult> => {
  const v1 = compileRules(RULES_V1)
  const v2 = compileRules(RULES_V2)
  const mainExecutable = new RegExp(`^${escapeRegex(options.mainExecutable)}$`)

  const files: [string, PlistValue][] = []
  const files2: [string, PlistValue][] = []
  let omitted = 0
  let optional = 0

  for (const entry of entries) {
    if (isExcluded(entry.path, mainExecutable)) continue

    const v1Value = await sealV1(entry, matchRule(v1, entry.path), hasher)
    if (v1Value !== undefined) files.push([entry.path, v1Value])

    const ruleV2 = matchRule(v2, entry.path)
    if (!ruleV2 || ruleV2.omit) {
      omitted++
      continue
    }
    if (ruleV2.optional) optional++
    files2.push([
      entry.path,
      await sealV2(entry, ruleV2, options.hashMode, hasher)
    ])
  }

  const plist = createDict([
    ['files', createDict(files)],
    ['files2', createDict(files2)],
    ['rules', rulesToPlist(RULES_V1)],
    ['rules2', rulesToPlist(RULES_V2)]
  ])

  return {
    bytes: serializeXmlPlist(plist),
    sealed: files2.length,
    omitted,
    optional
  }
}
