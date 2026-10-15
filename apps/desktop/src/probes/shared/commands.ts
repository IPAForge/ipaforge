export type ProbeCommand = () => Promise<void>
export type ProbeCommands = Readonly<Record<string, ProbeCommand>>

/** The command called `name`; an unknown name lists the valid ones and exits with status 2. */
export const selectCommand = (
  commands: ProbeCommands,
  name: string
): ProbeCommand => {
  const run = commands[name]
  if (run) return run
  console.error(
    `unknown command "${name}"; one of: ${Object.keys(commands).join(', ')}`
  )
  process.exit(2)
}
