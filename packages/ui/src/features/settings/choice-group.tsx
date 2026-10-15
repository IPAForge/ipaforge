import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { type ShellKey, t } from "@ui/locales/en-shell.ts";
import { type Key, useId } from "react";

interface ChoiceGroupProps<T extends string> {
  readonly labelKey: ShellKey;
  readonly options: readonly T[];
  readonly optionLabelKey: (option: T) => ShellKey;
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/** A labelled single-choice row of toggle buttons; selecting the current choice again keeps it. */
export const ChoiceGroup = <T extends string>({
  labelKey,
  options,
  optionLabelKey,
  value,
  onChange,
}: ChoiceGroupProps<T>) => {
  const labelId = useId();
  const onSelectionChange = (keys: Set<Key>) => {
    const [selected] = keys;
    const option = options.find((candidate) => candidate === selected);
    if (option) onChange(option);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span id={labelId} className="font-medium text-sm">
        {t(labelKey)}
      </span>
      <ToggleButtonGroup
        aria-labelledby={labelId}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[value]}
        onSelectionChange={onSelectionChange}
        className="flex-wrap"
      >
        {options.map((option) => (
          <ToggleButton key={option} id={option}>
            {t(optionLabelKey(option))}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
};
