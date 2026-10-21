import type { PreloadRow } from '@ui/features/preload/home/types.ts'
import type { RunApp } from '@ui/state/active-run/types.ts'

/** The ready apps of the list, as the run shows them: their name and version as read, and where they are. */
export const runAppsOf = (rows: readonly PreloadRow[]): RunApp[] =>
  rows.flatMap((row) =>
    row.status === 'ready' && row.item.source
      ? [
          {
            name: row.plan?.inspection.app.name ?? row.item.label,
            version: row.plan?.inspection.app.version,
            source: row.item.source,
            save: row.item.save === true
          }
        ]
      : []
  )
