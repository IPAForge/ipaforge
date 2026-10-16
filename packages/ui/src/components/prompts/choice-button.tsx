import { Button } from '@heroui/react'
import { TriangleAlert } from 'lucide-react'

type ChoiceButtonProps = {
  title: string
  description?: string | undefined
  /** Shown as a warning instead of a plain description (e.g. revoking SideStore's certificate). */
  warning?: string | undefined
  onPress: () => void
  /** This is the answer given, and the Engine is still acting on it. */
  isPending?: boolean | undefined
  /** Another answer was given and is being acted on. */
  isDisabled?: boolean | undefined
}

/** One answer to a question, as a large button: picking it answers at once. */
export const ChoiceButton = ({
  title,
  description,
  warning,
  onPress,
  isPending = false,
  isDisabled = false
}: ChoiceButtonProps) => (
  <Button
    variant="outline"
    fullWidth
    onPress={onPress}
    isPending={isPending}
    isDisabled={isDisabled}
    className="h-auto flex-col items-start gap-0.5 px-4 py-3 text-start"
  >
    <span className="font-semibold">{title}</span>
    {description ? (
      <span className="font-normal text-muted text-sm">{description}</span>
    ) : null}
    {warning ? (
      <span className="flex items-center gap-1 font-normal text-sm text-warning">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        {warning}
      </span>
    ) : null}
  </Button>
)
