/**
 * Allowed dependency edges between workspace packages (see docs/design/architecture.md).
 * Key = package directory under packages/, value = packages it may import.
 * A package missing from this table is itself a violation: add it here deliberately.
 */
export const allowedEdges: Readonly<Record<string, readonly string[]>> = {
  kernel: [],
  signer: ['kernel'],
  device: ['kernel'],
  apple: ['kernel'],
  catalog: ['kernel'],
  installer: ['kernel', 'signer', 'device', 'apple', 'catalog'],
  rpc: ['kernel', 'installer'],
  ui: ['kernel', 'rpc']
}

/** Modules that are platform-specific even though they are not Node built-ins. */
export const forbiddenModules: readonly string[] = ['electron']

export const workspaceScope = '@ipaforge/'
