import { highlightParts } from '@ui/features/logs/utils/highlight-parts.ts'

type HighlightedProps = { text: string; query: string }

/** `text` with every match of the search marked. */
export const Highlighted = ({ text, query }: HighlightedProps) =>
  highlightParts(text, query).map((part, index) =>
    part.isMatch ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: parts never move; the index is their identity
      <mark key={index} className="rounded-sm bg-warning-soft text-inherit">
        {part.text}
      </mark>
    ) : (
      part.text
    )
  )
