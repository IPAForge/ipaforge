import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { t } from "@ui/__tests__/test-i18n.ts";
import { renderApp } from "@ui/__tests__/test-services.tsx";
import type { TranslationKey } from "@ui/utils/i18n/i18next-types.ts";
import { describe, expect, it } from "vitest";

const pickers = [
  { labelKey: "topBar.device", valueKey: "topBar.noDevice", item: t("topBar.devicesFound", { count: 0 }) },
  { labelKey: "topBar.account", valueKey: "topBar.notSignedIn", item: t("topBar.addAppleIdSoon") },
] as const satisfies readonly { labelKey: TranslationKey; valueKey: TranslationKey; item: string }[];

const findBanner = () => screen.findByRole("banner");
const pickerName = (picker: (typeof pickers)[number]) => `${t(picker.labelKey)} ${t(picker.valueKey)}`;

describe("TopBar", () => {
  it("shows the app name", async () => {
    await renderApp("/install");
    expect(within(await findBanner()).getByText(t("app.name"))).toBeDefined();
  });

  it.each(pickers)("has a $labelKey menu button named by its label and value", async (picker) => {
    await renderApp("/install");
    const button = within(await findBanner()).getByRole("button", { name: pickerName(picker) });
    expect(button.getAttribute("aria-haspopup")).not.toBeNull();
    expect(button.getAttribute("aria-expanded")).not.toBe("true");
  });

  it.each(pickers)("opens the $labelKey menu with its disabled placeholder item", async (picker) => {
    const user = userEvent.setup();
    await renderApp("/install");
    const button = within(await findBanner()).getByRole("button", { name: pickerName(picker) });

    await user.click(button);

    const item = within(await screen.findByRole("menu")).getByRole("menuitem", { name: picker.item });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("opens a picker from the keyboard and closes it with Escape", async () => {
    const user = userEvent.setup();
    await renderApp("/install");
    const [devicePicker] = pickers;
    within(await findBanner())
      .getByRole("button", { name: pickerName(devicePicker) })
      .focus();

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("menu")).toBeDefined();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
