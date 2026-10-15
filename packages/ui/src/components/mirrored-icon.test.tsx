import { render } from "@testing-library/react";
import { MirroredIcon } from "@ui/components/mirrored-icon.tsx";
import { ChevronRight } from "lucide-react";
import { I18nProvider } from "react-aria-components";
import { describe, expect, it } from "vitest";

const MIRROR_CLASS = "-scale-x-100";

const iconClasses = (locale: string) => {
  const { container } = render(
    <I18nProvider locale={locale}>
      <MirroredIcon icon={ChevronRight} className="size-4" />
    </I18nProvider>,
  );
  return container.querySelector("svg")?.getAttribute("class") ?? "";
};

describe("MirroredIcon", () => {
  it("flips in a right-to-left language", () => {
    expect(iconClasses("ar")).toContain(MIRROR_CLASS);
    expect(iconClasses("he-IL")).toContain(MIRROR_CLASS);
  });

  it("stays as drawn in a left-to-right language, keeping its own classes", () => {
    const classes = iconClasses("en");
    expect(classes).not.toContain(MIRROR_CLASS);
    expect(classes).toContain("size-4");
  });
});
