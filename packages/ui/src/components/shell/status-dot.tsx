/** A small coloured dot: green when the thing it marks is connected or signed in, muted otherwise. Decorative. */
export const StatusDot = ({ isOn }: { isOn: boolean }) => (
  <span
    aria-hidden="true"
    className={`size-2 shrink-0 rounded-full ${isOn ? 'bg-success' : 'bg-muted'}`}
  />
)
