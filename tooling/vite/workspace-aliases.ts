// Vite/Vitest aliases generated from tsconfig.base.json "paths" — the single source of truth for
// absolute imports (`@kernel/…`, `@signer/…`). Shared by every package's vitest config and, later,
// the apps' Vite configs, so all tools resolve aliases exactly like TypeScript does.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '../..')

const readJsonc = (path: string): unknown =>
  JSON.parse(
    readFileSync(path, 'utf8')
      .replace(/^\s*\/\/.*$/gm, '') // line comments
      .replace(/,(\s*[}\]])/g, '$1') // trailing commas
  )

const escapeRegex = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const paths = (
  readJsonc(resolve(ROOT, 'tsconfig.base.json')) as {
    compilerOptions: { paths: Record<string, string[]> }
  }
).compilerOptions.paths

/** Structurally compatible with Vite's `Alias`. */
export type WorkspaceAlias = {
  readonly find: RegExp
  readonly replacement: string
}

export const workspaceAliases: WorkspaceAlias[] = Object.entries(paths).map(
  ([pattern, [target = '']]) => ({
    find: new RegExp(`^${escapeRegex(pattern.replace(/\/\*$/, ''))}/(.*)$`),
    replacement: `${resolve(ROOT, target.replace(/\/\*$/, ''))}/$1`
  })
)
