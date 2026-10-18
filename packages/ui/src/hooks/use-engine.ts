import type { EngineClient } from '@ipaforge/rpc'
import { useUiServices } from '@ui/hooks/use-ui-services.ts'

/** The Engine client the host provides. Components reach it only through the hooks built on this. */
export const useEngine = (): EngineClient => useUiServices().engine
