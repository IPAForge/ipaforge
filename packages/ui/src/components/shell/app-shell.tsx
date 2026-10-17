import type { ReactNode } from 'react'

import { Sidebar } from '@ui/components/shell/sidebar.tsx'
import { SkipLink } from '@ui/components/shell/skip-link.tsx'
import { TopBar } from '@ui/components/shell/top-bar.tsx'
import { DeviceNotes } from '@ui/features/devices/device-notes.tsx'

const MAIN_CONTENT_ID = 'main-content'

/** Top bar across the window, sidebar on the start edge, the current page in `main`. */
export const AppShell = ({ children }: { children: ReactNode }) => (
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
  </div>
)
