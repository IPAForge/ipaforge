import {
  createDict,
  type PlistDict,
  type PlistValue,
  real
} from '@ipaforge/kernel'
import type {
  CompiledRule,
  ResourceRule
} from '@signer/domain/code-resources/types.ts'

const rule = (
  pattern: string,
  options: { weight?: number; omit?: boolean; optional?: boolean } = {}
): ResourceRule => ({
  pattern,
  weight: options.weight ?? 1,
  omit: options.omit ?? false,
  optional: options.optional ?? false
})

/** Flat-bundle (iOS) rules, version 1 (`apple/bundlediskrep.cpp`). */
export const RULES_V1: readonly ResourceRule[] = [
  rule('^.*'),
  rule('^.*\\.lproj/', { optional: true, weight: 1000 }),
  rule('^.*\\.lproj/locversion.plist$', { omit: true, weight: 1100 }),
  rule('^Base\\.lproj/', { weight: 1010 }),
  rule('^version.plist$')
]

/** Flat-bundle (iOS) rules, version 2 (no `nested` rule: nested code is sealed as plain files). */
export const RULES_V2: readonly ResourceRule[] = [
  rule('.*\\.dSYM($|/)', { weight: 11 }),
  rule('^(.*/)?\\.DS_Store$', { omit: true, weight: 2000 }),
  rule('^.*'),
  rule('^.*\\.lproj/', { optional: true, weight: 1000 }),
  rule('^.*\\.lproj/locversion.plist$', { omit: true, weight: 1100 }),
  rule('^Base\\.lproj/', { weight: 1010 }),
  rule('^Info\\.plist$', { omit: true, weight: 20 }),
  rule('^PkgInfo$', { omit: true, weight: 20 }),
  rule('^embedded\\.provisionprofile$', { weight: 20 }),
  rule('^version\\.plist$', { weight: 20 })
]

export const compileRules = (rules: readonly ResourceRule[]): CompiledRule[] =>
  rules.map((r) => ({ ...r, regex: new RegExp(r.pattern) }))

/** Highest weight wins; ties keep the first rule (Apple's ResourceBuilder). */
export const matchRule = (
  rules: readonly CompiledRule[],
  path: string
): CompiledRule | undefined => {
  let best: CompiledRule | undefined
  for (const candidate of rules) {
    if (candidate.regex.test(path) && (!best || candidate.weight > best.weight))
      best = candidate
  }
  return best
}

/** How a rule is written into CodeResources: `<true/>` when flag-less weight 1, else a dict. */
export const rulesToPlist = (rules: readonly ResourceRule[]): PlistDict =>
  createDict(
    rules.map((r): [string, PlistValue] => {
      if (r.weight === 1 && !r.omit && !r.optional) return [r.pattern, true]
      const entries: [string, PlistValue][] = []
      if (r.omit) entries.push(['omit', true])
      if (r.optional) entries.push(['optional', true])
      entries.push(['weight', real(r.weight)])
      return [r.pattern, createDict(entries)]
    })
  )
