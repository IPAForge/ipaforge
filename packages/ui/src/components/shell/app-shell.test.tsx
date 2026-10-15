import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderApp } from "@ui/__tests__/test-services.tsx";
import { type ShellKey, t } from "@ui/locales/en-shell.ts";
import { sections } from "@ui/sections.ts";
import { describe, expect, it } from "vitest";

const navigationName = { name: t("shell.navigation") };
const sidebar = () => screen.getByRole("navigation", navigationName);
/** The router renders asynchronously: wait for the shell before querying it. */
const findSidebar = () => screen.findByRole("navigation", navigationName);
const manageKeys = [
  "nav.devices",
  "nav.accounts",
  "nav.certificates",
  "nav.logs",
  "nav.settings",
] as const satisfies readonly ShellKey[];
const linkLabels = (container: HTMLElement) =>
  within(container)
    .getAllByRole("link")
    .map((link) => link.textContent);

describe("AppShell", () => {
  it("has banner, navigation and main landmarks", async () => {
    renderApp("/devices");
    expect(await findSidebar()).toBeDefined();
    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("main")).toBeDefined();
  });

  it("lists every section in the sidebar, in order", async () => {
    renderApp("/devices");
    const links = within(await findSidebar()).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(sections.map((section) => t(section.labelKey)));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(sections.map((section) => section.path));
  });

  it("puts Install and Preload first, then the Manage group after a separator", async () => {
    renderApp("/install");
    const nav = await findSidebar();
    const [primary, manage] = within(nav).getAllByRole("list");

    expect(linkLabels(primary as HTMLElement)).toEqual([t("nav.install"), t("nav.preload")]);
    expect(within(nav).getByRole("list", { name: t("nav.group.manage") })).toBe(manage);
    expect(linkLabels(manage as HTMLElement)).toEqual(manageKeys.map(t));
    expect(within(nav).getAllByRole("separator")).toHaveLength(1);
  });

  it("marks only the active section as the current page", async () => {
    renderApp("/certificates");
    const active = await within(await findSidebar()).findByRole("link", { current: "page" });
    expect(active.textContent).toBe(t("nav.certificates"));
    expect(within(sidebar()).getAllByRole("link", { current: "page" })).toHaveLength(1);
  });

  it("moves the highlight when another section is chosen", async () => {
    const user = userEvent.setup();
    renderApp("/devices");
    await user.click(within(await findSidebar()).getByRole("link", { name: t("nav.logs") }));
    await waitFor(() =>
      expect(within(sidebar()).getByRole("link", { current: "page" }).textContent).toBe(t("nav.logs")),
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t("nav.logs"));
  });

  it("tabs through the skip link, the top bar pickers, then the sections in order", async () => {
    const user = userEvent.setup();
    renderApp("/devices");
    await findSidebar();

    await user.tab();
    expect(document.activeElement?.textContent).toBe(t("shell.skipToContent"));
    for (const labelKey of ["topBar.device", "topBar.account"] as const) {
      await user.tab();
      expect(document.activeElement?.getAttribute("aria-haspopup")).not.toBeNull();
      expect(document.activeElement?.textContent).toContain(t(labelKey));
    }
    for (const section of sections) {
      await user.tab();
      expect(document.activeElement?.textContent).toBe(t(section.labelKey));
    }
  });

  it("opens a section from the keyboard", async () => {
    const user = userEvent.setup();
    renderApp("/devices");
    within(await findSidebar())
      .getByRole("link", { name: t("nav.install") })
      .focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(t("install.title")));
  });
});
