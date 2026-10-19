import { useMemo } from 'react'

import { qrPath } from '@ui/components/utils/qr-path.ts'

type QrCodeProps = {
  value: string
  label: string
}

/** A QR code of `value`, drawn here (nothing leaves the computer); always dark on white, so a camera reads it. */
export const QrCode = ({ value, label }: QrCodeProps) => {
  const { path, size } = useMemo(() => qrPath(value), [value])

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className="size-48 max-w-full shrink-0 rounded-xl border border-border bg-white"
    >
      <path d={path} className="fill-black" />
    </svg>
  )
}
