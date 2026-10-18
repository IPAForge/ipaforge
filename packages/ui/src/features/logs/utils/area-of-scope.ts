import { LOG_AREA_SCOPES, LOG_AREAS } from '@ui/features/logs/constants.ts'
import type { LogArea } from '@ui/state/log-view/types.ts'

const covers = (scope: string, wanted: string) =>
  scope === wanted || scope.startsWith(`${wanted}.`)

/** The area a line's scope belongs to; a line without a known scope is the app's. */
export const areaOfScope = (scope: string | undefined): LogArea =>
  LOG_AREAS.find((area) =>
    LOG_AREA_SCOPES[area].some((wanted) => covers(scope ?? '', wanted))
  ) ?? 'app'
