import type { TFunction } from 'i18next'

import type { ActiveRun } from '@ui/state/active-run/types.ts'

/**
 * What a run installs, for the diagnostics (in English): "SideStore, Stable (sidestore, stable)", or each app of an
 * apps run with its version and where it came from ("StikDebug 3.1.15 (catalog), MyGame 1.4 (file)").
 */
export const installLine = (run: ActiveRun, en: TFunction): string => {
  if (run.kind === 'sidestore') {
    const { variant, channel = 'stable' } = run.input
    const app = en(`install.variant.${variant}.title`)
    const channelName = en(`install.channel.${channel}`)

    return `${app}, ${channelName} (${variant}, ${channel})`
  }
  return run.apps
    .map((app) =>
      [app.name, app.version, `(${app.source.kind})`].filter(Boolean).join(' ')
    )
    .join(', ')
}
