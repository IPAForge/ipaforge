import { Card } from "@heroui/react";
import { ChoiceGroup } from "@ui/features/settings/choice-group.tsx";
import { PaletteSwatches } from "@ui/features/settings/palette-swatches.tsx";
import { useTheme } from "@ui/hooks/use-theme.ts";
import { type ColorMode, colorModes } from "@ui/theme/theme-types.ts";
import type { TranslationKey } from "@ui/utils/i18n/i18next-types.ts";
import { useTranslation } from "react-i18next";

const modeLabelKey = (mode: ColorMode): TranslationKey => `theme.mode.${mode}`;

/** Colour mode and palette, saved through the theme store. */
export const AppearanceSettings = () => {
  const { t } = useTranslation();
  const { mode, setMode } = useTheme();

  return (
    <Card>
      <Card.Content className="flex flex-col gap-5">
        <h2 className="font-semibold text-lg">{t("settings.appearance")}</h2>
        <ChoiceGroup
          labelKey="settings.mode"
          options={colorModes}
          optionLabelKey={modeLabelKey}
          value={mode}
          onChange={setMode}
        />
        <PaletteSwatches />
      </Card.Content>
    </Card>
  );
};
