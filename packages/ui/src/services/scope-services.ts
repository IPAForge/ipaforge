import { withRequestLogging } from '@ui/services/engine/logged-engine.ts'
import type { UiServices } from '@ui/services/ui-services.ts'

/** Every UI log record is under this scope; features add their own below it (`ui.theme`, `ui.i18n`). */
const UI_LOG_SCOPE = 'ui'

/** The host's services with the logger scoped to the UI and every Engine request logged under `ui.engine`. */
export const scopeServices = (services: UiServices): UiServices => {
  const logger = services.logger.child({ scope: UI_LOG_SCOPE })

  return {
    ...services,
    logger,
    engine: withRequestLogging(services.engine, logger)
  }
}
