type AppIconProps = {
  name: string
  size?: 'sm' | 'md'
}

/** A stand-in app icon: the app's first letter on a tile (IPAs are not opened to read their icon). */
export const AppIcon = ({ name, size = 'md' }: AppIconProps) => (
  <span
    aria-hidden="true"
    className={`grid shrink-0 place-items-center rounded-lg bg-surface-tertiary font-semibold ${size === 'sm' ? 'size-7 text-sm' : 'size-9'}`}
  >
    {name.trim().charAt(0).toUpperCase() || '?'}
  </span>
)
