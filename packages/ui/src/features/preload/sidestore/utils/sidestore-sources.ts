import type { SourceInfo } from '@ui/services/engine/types.ts'

/**
 * The sources that can be added to SideStore: the ones you added, in the AltStore format SideStore reads. The
 * IPAForge catalog isn't in that format, and SideStore has its own source already.
 */
export const isSideStoreSource = (source: SourceInfo): boolean =>
  !source.builtin && source.kind === 'altstore'
