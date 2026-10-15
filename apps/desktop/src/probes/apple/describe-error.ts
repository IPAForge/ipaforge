import { LoadstarError } from '@loadstar/kernel'

/** `code (message) {data}`, leaving out a message that only repeats the code and empty data. */
export const describeError = (error: unknown): string => {
  if (!(error instanceof LoadstarError)) return String(error)
  const message = error.message !== error.code ? ` (${error.message})` : ''
  const data = error.data ? ` ${JSON.stringify(error.data)}` : ''

  return `${error.code}${message}${data}`
}
