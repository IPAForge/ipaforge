import type { ReactNode } from 'react'

type SettingRowProps = {
  /** The title's id, which names the control. */
  titleId: string
  title: string
  hint?: string | undefined
  hintId?: string | undefined
  /** The control below the title rather than beside it (the palettes). */
  isFull?: boolean
  children: ReactNode
}

/** One setting in a settings card: its name and what it does on the start side, the control on the end side. */
export const SettingRow = ({
  titleId,
  title,
  hint,
  hintId,
  isFull = false,
  children
}: SettingRowProps) => (
  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-border border-t py-4 first:border-t-0 first:pt-1 last:pb-0">
    <div className="flex min-w-0 flex-[1_1_15rem] flex-col gap-0.5">
      <h3 id={titleId} className="font-medium">
        {title}
      </h3>
      {hint ? (
        <p id={hintId} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
    <div
      className={
        isFull
          ? 'flex min-w-0 basis-full'
          : 'ms-auto flex min-w-0 flex-wrap justify-end gap-2'
      }
    >
      {children}
    </div>
  </div>
)
