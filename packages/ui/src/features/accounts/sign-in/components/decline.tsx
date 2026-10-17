import { useEffect } from 'react'

type DeclineProps = { onDecline: () => void }

/** Declines a question sign-in does not ask, so the run ends instead of waiting forever. */
export const Decline = ({ onDecline }: DeclineProps) => {
  useEffect(() => onDecline(), [onDecline])
  return null
}
