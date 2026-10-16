import { QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'

import {
  createTestServices,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import { createQueryClient } from '@ui/hooks/queries/query-client.ts'
import { UiServicesContext } from '@ui/services/ui-services.ts'

/** Renders a hook inside the providers `App` gives it (the host's services and the query cache), without the UI. */
export const renderAppHook = <T,>(
  hook: () => T,
  options: TestServicesOptions = {}
) => {
  const test = createTestServices(options)
  const queryClient = createQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UiServicesContext value={test.services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </UiServicesContext>
  )

  return { ...test, queryClient, ...renderHook(hook, { wrapper }) }
}
