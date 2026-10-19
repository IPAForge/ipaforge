import type {
  ChecklistItem,
  ChecklistProgress
} from '@ui/features/devices/checklist/types.ts'

/** Counts the lines to do or done; reminders, later and not-needed lines don't count. */
export const checklistProgress = (
  items: readonly ChecklistItem[]
): ChecklistProgress => {
  const counted = items.filter(
    (item) =>
      item.state === 'done' || item.state === 'todo' || item.state === 'self'
  )
  const done = counted.filter((item) => item.state === 'done').length

  return {
    done,
    total: counted.length,
    left: counted.length - done,
    seenLeft: items.filter((item) => item.state === 'todo').length
  }
}
