/**
 * Checks the UI's locale files against `en.json`, the source of truth:
 *  - `status.json` lists exactly the locale files present, each as "source", "draft" or "reviewed";
 *  - no language misses a key of `en.json` or has a key `en.json` lacks;
 *  - every message is valid ICU MessageFormat and uses the same arguments (name and type) as English;
 * then reports each language's completion (non-empty messages; an empty one falls back to English).
 *
 * Usage: pnpm check:locales [--dir <locales dir>]
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  type MessageFormatElement,
  parse,
  TYPE
} from '@formatjs/icu-messageformat-parser'

const DEFAULT_DIR = 'packages/ui/src/locales'
const STATUS_FILE = 'status.json'
const SOURCE = 'en'
const STATUSES = ['source', 'draft', 'reviewed'] as const
const PERCENT = 100

export type Problem =
  | 'status'
  | 'missing-file'
  | 'unlisted-file'
  | 'invalid-json'
  | 'missing-key'
  | 'extra-key'
  | 'not-a-string'
  | 'invalid-icu'
  | 'placeholder-mismatch'

export type Issue = {
  readonly language: string
  readonly key?: string
  readonly problem: Problem
  readonly detail: string
}

export type Completion = {
  readonly language: string
  readonly status: string
  readonly translated: number
  readonly total: number
}

export type LocaleReport = {
  readonly issues: readonly Issue[]
  readonly completion: readonly Completion[]
}

type Messages = ReadonlyMap<string, unknown>

/** Flattens nested JSON into dotted keys: `{ a: { b: "x" } }` → `a.b` → "x". Non-object leaves are kept as is. */
export const flatten = (tree: unknown, prefix = ''): Map<string, unknown> => {
  const entries = new Map<string, unknown>()
  if (tree === null || typeof tree !== 'object' || Array.isArray(tree))
    return entries
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    const isBranch =
      value !== null && typeof value === 'object' && !Array.isArray(value)
    if (isBranch)
      for (const [leaf, text] of flatten(value, path)) entries.set(leaf, text)
    else entries.set(path, value)
  }
  return entries
}

/** The arguments a message uses, as sorted "name:type" strings ("count:plural", "name:argument"). */
export const argumentsOf = (
  elements: readonly MessageFormatElement[]
): string[] => {
  const found = new Set<string>()
  const visit = (nodes: readonly MessageFormatElement[]): void => {
    for (const node of nodes) {
      if (node.type === TYPE.literal || node.type === TYPE.pound) continue
      if (node.type === TYPE.tag) {
        visit(node.children)
        continue
      }
      found.add(`${node.value}:${TYPE[node.type]}`)
      if (node.type === TYPE.plural || node.type === TYPE.select) {
        for (const option of Object.values(node.options)) visit(option.value)
      }
    }
  }
  visit(elements)
  return [...found].sort()
}

const parseMessage = (
  text: string
): { elements?: MessageFormatElement[]; error?: string } => {
  try {
    return { elements: parse(text, { requiresOtherClause: true }) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

const readJson = (path: string): { value?: unknown; error?: string } => {
  try {
    return { value: JSON.parse(readFileSync(path, 'utf8')) }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

const listLocaleFiles = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== STATUS_FILE)
    .map((name) => name.slice(0, -'.json'.length))
    .sort()

const checkStatus = (
  status: unknown,
  files: readonly string[]
): { statuses: Map<string, string>; issues: Issue[] } => {
  const issues: Issue[] = []
  const statuses = new Map<string, string>()
  const listed =
    status !== null && typeof status === 'object' ? Object.entries(status) : []
  for (const [language, value] of listed) {
    if (!STATUSES.some((known) => known === value)) {
      issues.push({
        language,
        problem: 'status',
        detail: `status must be one of ${STATUSES.join(', ')}`
      })
    }
    statuses.set(language, String(value))
    if (!files.includes(language))
      issues.push({
        language,
        problem: 'missing-file',
        detail: `no ${language}.json`
      })
  }
  for (const language of files) {
    if (!statuses.has(language)) {
      issues.push({
        language,
        problem: 'unlisted-file',
        detail: `${language}.json is not listed in ${STATUS_FILE}`
      })
    }
  }
  if (statuses.get(SOURCE) !== 'source') {
    issues.push({
      language: SOURCE,
      problem: 'status',
      detail: `${SOURCE} must be listed as "source"`
    })
  }
  return { statuses, issues }
}

/** Every problem with one message, compared with its English source (undefined for English itself). */
const checkMessage = (
  language: string,
  key: string,
  text: unknown,
  source: string | undefined
): Issue[] => {
  if (typeof text !== 'string')
    return [
      { language, key, problem: 'not-a-string', detail: 'messages are strings' }
    ]
  if (text === '') return [] // untranslated: falls back to English
  const parsed = parseMessage(text)
  if (!parsed.elements)
    return [
      { language, key, problem: 'invalid-icu', detail: parsed.error ?? '' }
    ]
  if (source === undefined) return []
  const expected = parseMessage(source).elements
  if (!expected) return [] // reported on English
  const want = argumentsOf(expected).join(', ')
  const got = argumentsOf(parsed.elements).join(', ')

  return want === got
    ? []
    : [
        {
          language,
          key,
          problem: 'placeholder-mismatch',
          detail: `expected {${want}}, found {${got}}`
        }
      ]
}

const checkLanguage = (
  language: string,
  messages: Messages,
  english: Messages
): Issue[] => {
  const isSource = language === SOURCE
  const issues: Issue[] = []
  for (const key of english.keys()) {
    if (!messages.has(key))
      issues.push({
        language,
        key,
        problem: 'missing-key',
        detail: `missing (in ${SOURCE})`
      })
  }
  for (const [key, text] of messages) {
    if (!english.has(key)) {
      issues.push({
        language,
        key,
        problem: 'extra-key',
        detail: `not in ${SOURCE}`
      })
      continue
    }
    const source = english.get(key)
    issues.push(
      ...checkMessage(
        language,
        key,
        text,
        isSource || typeof source !== 'string' ? undefined : source
      )
    )
  }
  return issues
}

const countTranslated = (messages: Messages, english: Messages): number =>
  [...english.keys()].filter((key) => {
    const text = messages.get(key)

    return typeof text === 'string' && text !== ''
  }).length

export const checkLocales = (dir: string): LocaleReport => {
  const files = listLocaleFiles(dir)
  const status = readJson(join(dir, STATUS_FILE))
  const { statuses, issues } = checkStatus(status.value, files)
  if (status.error)
    issues.push({
      language: STATUS_FILE,
      problem: 'invalid-json',
      detail: status.error
    })

  const loaded = new Map<string, Messages>()
  for (const language of files) {
    const json = readJson(join(dir, `${language}.json`))
    if (json.error)
      issues.push({ language, problem: 'invalid-json', detail: json.error })
    else loaded.set(language, flatten(json.value))
  }
  const english = loaded.get(SOURCE) ?? new Map<string, unknown>()
  const completion: Completion[] = []
  for (const [language, messages] of loaded) {
    issues.push(...checkLanguage(language, messages, english))
    completion.push({
      language,
      status: statuses.get(language) ?? 'unlisted',
      translated: countTranslated(messages, english),
      total: english.size
    })
  }
  return { issues, completion }
}

const percent = ({ translated, total }: Completion): number =>
  total === 0 ? 0 : Math.floor((translated / total) * PERCENT)

export const formatIssue = (issue: Issue): string =>
  `[locales] ${issue.language}${issue.key ? ` ${issue.key}` : ''}  ${issue.problem}: ${issue.detail}`

export const formatCompletion = (entry: Completion): string =>
  `[locales] ${entry.language.padEnd(6)} ${String(percent(entry)).padStart(3)} %  ${entry.translated}/${entry.total}  ${entry.status}`

const main = (argv: readonly string[]): number => {
  const dirFlag = argv.indexOf('--dir')
  const dir = resolve(
    (dirFlag >= 0 ? argv[dirFlag + 1] : undefined) ?? DEFAULT_DIR
  )
  const report = checkLocales(dir)
  for (const issue of report.issues) console.error(formatIssue(issue))
  for (const entry of report.completion) console.info(formatCompletion(entry))
  console.info(
    `[locales] ${report.completion.length} languages, ${report.issues.length} problems`
  )
  return report.issues.length === 0 ? 0 : 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = main(process.argv.slice(2))
}
