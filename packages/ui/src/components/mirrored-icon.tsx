import type { LucideIcon, LucideProps } from "lucide-react";
import { useLocale } from "react-aria-components";

const MIRROR_CLASS = "-scale-x-100";

interface MirroredIconProps extends LucideProps {
  readonly icon: LucideIcon;
}

/**
 * An icon that points along the reading direction (a "next" chevron, a "back" arrow), flipped
 * horizontally in right-to-left languages. Symmetric or absolute icons (a down chevron) don't need it.
 */
export const MirroredIcon = ({ icon: Icon, className, ...props }: MirroredIconProps) => {
  const isRtl = useLocale().direction === "rtl";
  const classes = [className, isRtl ? MIRROR_CLASS : undefined].filter(Boolean).join(" ");
  return <Icon aria-hidden="true" {...props} className={classes} />;
};
