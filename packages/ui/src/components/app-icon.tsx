import { iconColors } from '@ui/components/utils/icon-colors.ts'

type AppIconProps = {
  name: string
  size?: 'sm' | 'md'
  /** The app's colour from its source (`#rrggbb`); without one, a colour picked by name. */
  tint?: string | undefined
}

/** A stand-in app icon: the app's first letter on a tile in its colour (IPAs are not opened to read their icon). */
export const AppIcon = ({ name, size = 'md', tint }: AppIconProps) => (
  <span
    aria-hidden="true"
    className={`grid shrink-0 place-items-center rounded-lg font-semibold ${size === 'sm' ? 'size-7 text-sm' : 'size-9'}`}
    style={iconColors(name, tint)}
  >
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>
)
