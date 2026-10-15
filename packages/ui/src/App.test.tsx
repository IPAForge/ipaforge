import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@ui/__tests__/test-services.tsx";
import { t } from "@ui/locales/en-shell.ts";
import { palettes } from "@ui/theme/palettes.ts";
import { ThemePreferenceKey } from "@ui/theme/theme-config.ts";
import { describe, expect, it } from "vitest";

const html = () => document.documentElement;

describe("App", () => {
  it("mounts and redirects / to the install section", async () => {
    const { history } = renderApp("/");
    expect((await screen.findByRole("heading", { level: 1 })).textContent).toBe(t("install.title"));
    expect(history.location.pathname).toBe("/install");
  });

  it("applies the default palette to <html>", async () => {
    renderApp("/devices");
    await screen.findByRole("main");
    expect(html().style.getPropertyValue("--accent")).toBe(palettes.graphite.light.accent);
    expect(html().getAttribute("data-theme")).toBe("light");
  });

  it("logs navigation under ui.router", async () => {
    const { records } = renderApp("/");
    await screen.findByRole("main");
    await waitFor(() =>
      expect(records).toContainEqual(
        expect.objectContaining({ level: "debug", scope: "ui.router", msg: "navigated", fields: { to: "/install" } }),
      ),
    );
  });

  it("follows the OS scheme in system mode", async () => {
    const { scheme } = renderApp("/devices");
    await screen.findByRole("main");
    scheme.change("dark");
    await waitFor(() => expect(html().getAttribute("data-theme")).toBe("dark"));
    expect(html().style.getPropertyValue("--background")).toBe(palettes.graphite.dark.background);
  });

  it("changes and persists the palette and mode from Settings", async () => {
    const user = userEvent.setup();
    const { services, records } = renderApp("/settings");

    await user.click(await screen.findByRole("radio", { name: t("theme.palette.ocean") }));
    await user.click(screen.getByRole("radio", { name: t("theme.mode.dark") }));

    await waitFor(() => expect(html().style.getPropertyValue("--accent")).toBe(palettes.ocean.dark.accent));
    expect(services.preferences.read(ThemePreferenceKey.Palette)).toBe("ocean");
    expect(services.preferences.read(ThemePreferenceKey.Mode)).toBe("dark");
    expect((screen.getByRole("radio", { name: t("theme.palette.ocean") }) as HTMLInputElement).checked).toBe(true);
    expect(records).toContainEqual(expect.objectContaining({ scope: "ui.theme", msg: "palette changed" }));
  });
});
