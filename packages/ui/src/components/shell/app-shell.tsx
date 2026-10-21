import type { ReactNode } from 'react'

import { MAIN_CONTENT_ID } from '@ui/components/shell/constants.ts'
import { Sidebar } from '@ui/components/shell/sidebar.tsx'
import { SkipLink } from '@ui/components/shell/skip-link.tsx'
import { TopBar } from '@ui/components/shell/top-bar.tsx'
import { AutoRefresher } from '@ui/features/apps/components/auto-refresher.tsx'
import { DeviceNotes } from '@ui/features/devices/components/device-notes.tsx'
import { GuideAutoOpen } from '@ui/features/guide/components/guide-auto-open.tsx'
import { GuideBanner } from '@ui/features/guide/components/guide-banner.tsx'
import { SetupGuide } from '@ui/features/guide/setup-guide.tsx'
import { RunPromptHost } from '@ui/features/install/prompts/run-prompt-host.tsx'
import { LogsShortcut } from '@ui/features/logs/components/logs-shortcut.tsx'
import { TourHost } from '@ui/features/tour/components/tour-host.tsx'
import { WhatsNewHost } from '@ui/features/whats-new/components/whats-new-host.tsx'
import { useGuide } from '@ui/hooks/use-guide.ts'

type AppShellProps = { children: ReactNode }

/**
 * Top bar across the window, sidebar on the start edge, the current page in `main` (or the setup guide while it
 * is open, by itself at launch while no Apple ID is saved, with a banner to continue it after Finish later), the run's questions, the shortcut to Logs, refreshing
 * apps by themselves, What's new after an update, and the tour of the pages.
 */
export const AppShell = ({ children }: AppShellProps) => {
  const { guide } = useGuide()

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <SkipLink targetId={MAIN_CONTENT_ID} />
      <TopBar />
      {guide.status === 'open' ? (
        <SetupGuide />
      ) : (
        <>
          <GuideBanner />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main
              id={MAIN_CONTENT_ID}
              tabIndex={-1}
              className="min-w-0 flex-1 overflow-y-auto p-6 outline-none"
            >
              {children}
            </main>
          </div>
        </>
      )}
      <DeviceNotes />
      <RunPromptHost />
      <LogsShortcut />
      <AutoRefresher />
      <WhatsNewHost />
      <TourHost />
      <GuideAutoOpen />
    </div>
  )
}
