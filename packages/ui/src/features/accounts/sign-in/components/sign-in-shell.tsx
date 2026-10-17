import { Modal } from '@heroui/react'
import type { ReactNode } from 'react'

type SignInShellProps = {
  onClose: () => void
  children: ReactNode
}

/** The sign-in dialog's frame, closed by Escape or a click outside. */
export const SignInShell = ({ onClose, children }: SignInShellProps) => {
  const onOpenChange = (open: boolean) => {
    if (!open) onClose()
  }

  return (
    <Modal>
      <Modal.Backdrop isOpen onOpenChange={onOpenChange}>
        <Modal.Container placement="center">
          <Modal.Dialog>{children}</Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}
