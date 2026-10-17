import type { ReactNode } from 'react'

type WaitingProps = { children: ReactNode }

/** Why there's nothing to show yet: being read, or waiting for the device or a sign-in. */
export const Waiting = ({ children }: WaitingProps) => (
  <p className="text-muted text-sm">{children}</p>
)
