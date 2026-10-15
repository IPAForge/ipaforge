/** Limits that protect plist parsing against hostile input. */
export interface PlistLimits {
  /** Maximum nesting depth of arrays/dicts. */
  readonly maxDepth: number;
  /** Maximum nodes in the fully expanded value (shared references counted every time they appear). */
  readonly maxExpandedNodes: number;
  /** Maximum string/data bytes in the fully expanded value. */
  readonly maxExpandedBytes: number;
}

export const DEFAULT_PLIST_LIMITS: PlistLimits = {
  maxDepth: 64,
  maxExpandedNodes: 1_000_000,
  maxExpandedBytes: 64 * 1024 * 1024,
};
