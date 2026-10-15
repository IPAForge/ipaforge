// Size accounting for a binary plist's fully expanded tree, where shared objects count every time they appear.

import type { PlistLimits } from '@kernel/plist/limits.ts'
import type { PlistValue } from '@kernel/plist/model.ts'

export type Parsed = {
  readonly value: PlistValue
  /** Nodes in the fully expanded subtree. */
  readonly nodes: number
  /** String/data bytes in the fully expanded subtree. */
  readonly bytes: number
  /** Height of the subtree (1 for scalars). Checked on every reuse, so cached subtrees can't deepen the tree. */
  readonly height: number
}

/** Running totals of a container while its children are parsed. */
export type Totals = {
  nodes: number
  bytes: number
  height: number
}

export const leaf = (value: PlistValue, bytes: number): Parsed => ({
  value,
  nodes: 1,
  bytes,
  height: 1
})

/** Totals of a container before any children are added: just the container node. */
export const emptyContainerTotals = (): Totals => ({
  nodes: 1,
  bytes: 0,
  height: 1
})

export const addChild = (totals: Totals, child: Parsed): void => {
  totals.nodes += child.nodes
  totals.bytes += child.bytes
  totals.height = Math.max(totals.height, child.height + 1)
}

export const exceedsLimits = (
  totals: Pick<Totals, 'nodes' | 'bytes'>,
  limits: PlistLimits
): boolean =>
  totals.nodes > limits.maxExpandedNodes ||
  totals.bytes > limits.maxExpandedBytes
