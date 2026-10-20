import { useId } from 'react'

import { logoColors } from '@ui/components/shell/constants.ts'

/**
 * The app icon drawn inline, next to the app name: a phone with a spark on the indigo tile. The gradient ids are
 * unique per use, so two marks on one page don't share them.
 */
export const AppLogo = () => {
  const id = useId()
  const tile = `${id}-tile`
  const spark = `${id}-spark`

  return (
    <svg
      aria-hidden="true"
      className="size-6 shrink-0"
      focusable="false"
      viewBox="100 100 824 824"
    >
      <defs>
        <linearGradient id={tile} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={logoColors.tileFrom} />
          <stop offset="1" stopColor={logoColors.tileTo} />
        </linearGradient>
        <linearGradient id={spark} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={logoColors.sparkFrom} />
          <stop offset="1" stopColor={logoColors.sparkTo} />
        </linearGradient>
      </defs>
      <rect
        fill={`url(#${tile})`}
        height="824"
        rx="185"
        width="824"
        x="100"
        y="100"
      />
      <rect
        fill="none"
        height="560"
        rx="72"
        stroke={logoColors.phone}
        strokeWidth="44"
        width="424"
        x="300"
        y="250"
      />
      <rect
        fill={logoColors.phone}
        height="34"
        rx="17"
        width="144"
        x="440"
        y="700"
      />
      <path
        d="M512 330 L560 452 L682 500 L560 548 L512 670 L464 548 L342 500 L464 452 Z"
        fill={`url(#${spark})`}
      />
    </svg>
  )
}
