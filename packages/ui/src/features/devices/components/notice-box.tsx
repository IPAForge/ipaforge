import type { ReactNode } from 'react'

import { noticeToneClasses } from '@ui/features/devices/constants.ts'
import type { Notice } from '@ui/features/devices/types.ts'

type NoticeBoxProps = {
  status: Notice['status']
  title: string
  body: ReactNode
  action?: ReactNode
}

/** A tinted box: the title in the tone's colour, what to do, and its buttons under the text. */
export const NoticeBox = ({ status, title, body, action }: NoticeBoxProps) => (
  <div
    role="status"
    className={`flex flex-col gap-1 rounded-xl px-4 py-3 text-sm ${noticeToneClasses[status].box}`}
  >
    <p className={`font-medium ${noticeToneClasses[status].title}`}>{title}</p>
    <div className="text-muted">{body}</div>
    {action ? <div className="mt-2 flex flex-wrap gap-2">{action}</div> : null}
  </div>
)
