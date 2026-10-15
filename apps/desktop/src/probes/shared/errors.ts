// How the probes print a failure: the error itself, then every `cause` beneath it, so the root problem shows.

const MAX_CAUSES = 5

type ErrorLike = {
  readonly name?: string
  readonly message?: string
  readonly code?: string
  readonly cause?: unknown
}

const describeOne = (error: unknown): string => {
  if (typeof error !== 'object' || error === null) return String(error)
  const { name, message, code } = error as ErrorLike

  return [name, code, message]
    .filter((part) => part !== undefined && part !== '')
    .join(': ')
}

/** One line per error in the `cause` chain, outermost first. */
export const causeChain = (error: unknown): string[] => {
  const lines: string[] = []
  let current = (error as ErrorLike | undefined)?.cause
  while (current !== undefined && lines.length < MAX_CAUSES) {
    lines.push(`  caused by ${describeOne(current)}`)
    current =
      typeof current === 'object' && current !== null
        ? (current as ErrorLike).cause
        : undefined
  }
  return lines
}
