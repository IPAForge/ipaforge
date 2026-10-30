import { Modal } from '@heroui/react'
import type { ReactNode } from 'react'

type PairShellProps = {
  onClose: () => void
  children: ReactNode
}

/** The pairing dialog's frame, closed by Escape or a click outside (which ends a pairing under way). */
export const PairShell = ({ onClose, children }: PairShellProps) => {
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-lg">{children}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
