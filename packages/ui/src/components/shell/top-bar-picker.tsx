import { Dropdown } from "@heroui/react";
import { compact } from "@loadstar/kernel";
import { StatusDot } from "@ui/components/shell/status-dot.tsx";
import type { TranslationKey } from "@ui/utils/i18n/i18next-types.ts";
import { ChevronDown } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

export interface TopBarPickerProps {
  readonly id: string;
  /** What is picked ("Device"); with the value it names the button. */
  readonly labelKey: TranslationKey;
  /** The current choice, or its placeholder. */
  readonly valueKey: TranslationKey;
  readonly isOn: boolean;
  readonly menuLabelKey: TranslationKey;
  /** The single disabled entry shown until real choices exist (6c). */
  readonly emptyItemKey: TranslationKey;
  /** For an entry that counts what was found ("No devices yet"). */
  readonly emptyItemCount?: number;
}

const TRIGGER_CLASSES = [
  "flex min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-secondary px-2.5 py-1.5 text-sm outline-none",
  "hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus",
].join(" ");

/** A menu button in the top bar: status dot, label and current value, opening a menu of choices. */
export const TopBarPicker = ({
  id,
  labelKey,
  valueKey,
  isOn,
  menuLabelKey,
  emptyItemKey,
  emptyItemCount,
}: TopBarPickerProps) => {
  const { t } = useTranslation();
  const labelId = useId();
  const valueId = useId();
  return (
    <Dropdown>
      <Dropdown.Trigger aria-labelledby={`${labelId} ${valueId}`} className={TRIGGER_CLASSES}>
        <StatusDot isOn={isOn} />
        <span id={labelId} className="text-muted text-xs">
          {t(labelKey)}
        </span>
        <span id={valueId} className="truncate">
          {t(valueKey)}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu aria-label={t(menuLabelKey)}>
          <Dropdown.Item id={`${id}-empty`} isDisabled>
            {t(emptyItemKey, compact({ count: emptyItemCount }))}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
};
