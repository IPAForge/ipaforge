import type { ReactNode } from 'react'

import { MAIN_CONTENT_ID } from '@ui/components/shell/constants.ts'
import { Sidebar } from '@ui/components/shell/sidebar.tsx'
import { SkipLink } from '@ui/components/shell/skip-link.tsx'
import { TopBar } from '@ui/components/shell/top-bar.tsx'
import { DeviceNotes } from '@ui/features/devices/components/device-notes.tsx'
import { RunPromptHost } from '@ui/features/install/prompts/run-prompt-host.tsx'

type AppShellProps = { children: ReactNode }

/** Top bar across the window, sidebar on the start edge, the current page in `main`, and the run's questions. */
export const AppShell = ({ children }: AppShellProps) => (
  <div className="flex h-dvh flex-col bg-background text-foreground">
    <SkipLink targetId={MAIN_CONTENT_ID} />
    <TopBar />
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
    <DeviceNotes />
    <RunPromptHost />
  </div>
)
