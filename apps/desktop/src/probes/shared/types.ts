export type ProbeCommand = () => Promise<void>

export type ProbeCommands = Readonly<Record<string, ProbeCommand>>

export type Prompt = {
  readonly ask: (question: string) => Promise<string>
  /** Reads a line without echoing it. */
  readonly askHidden: (question: string) => Promise<string>
  /** A yes/no question that defaults to no: true only for "y". */
  readonly confirm: (question: string) => Promise<boolean>
  readonly close: () => void
}

export type MutableStdout = NodeJS.WriteStream & { _mute?: boolean }
