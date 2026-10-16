import { QueryClientProvider } from '@tanstack/react-query'
import { render, renderHook } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'

import {
  createTestServices,
  type TestServicesOptions
} from '@ui/__tests__/test-services.tsx'
import { createQueryClient } from '@ui/hooks/queries/query-client.ts'
import { LanguageProvider } from '@ui/i18n/provider/language-provider.tsx'
import {
  type LanguageSetup,
  prepareLanguage
} from '@ui/i18n/setup/prepare-language.ts'
import { UiServicesContext } from '@ui/services/ui-services.ts'

/** The providers `App` gives everything below it: the host's services, the query cache and, if given, the language. */
const createAppWrapper = (
  options: TestServicesOptions,
  language?: LanguageSetup
) => {
  const test = createTestServices(options)
  const queryClient = createQueryClient()
  const withLanguage = (children: ReactNode) =>
    language ? (
      <LanguageProvider setup={language}>{children}</LanguageProvider>
    ) : (
      children
    )
  const wrapper = ({ children }: { children: ReactNode }) => (
    <UiServicesContext value={test.services}>
      <QueryClientProvider client={queryClient}>
        {withLanguage(children)}
      </QueryClientProvider>
    </UiServicesContext>
  )

  return { ...test, queryClient, wrapper }
}

/** Renders a hook inside the providers `App` gives it, without the UI. */
export const renderAppHook = <T,>(
  hook: () => T,
  options: TestServicesOptions = {}
) => {
  const { wrapper, ...test } = createAppWrapper(options)

  return { ...test, ...renderHook(hook, { wrapper }) }
}

/** Renders one component inside the providers `App` gives it, in English (or the OS languages given). */
export const renderInApp = async (
  ui: ReactElement,
  options: TestServicesOptions = {}
) => {
  const language = await prepareLanguage(createTestServices(options).services)
  const { wrapper, ...test } = createAppWrapper(options, language)

  return { ...test, ...render(ui, { wrapper }) }
}
