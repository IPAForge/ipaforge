import { createMediaColorSchemeSource } from "@ui/services/color-scheme-source.ts";
import { describe, expect, it, vi } from "vitest";

/** A `matchMedia` whose single query result the test can flip and fire `change` on. */
const fakeMatchMedia = (initiallyDark: boolean) => {
  const target = new EventTarget();
  const query = Object.assign(target, { matches: initiallyDark }) as unknown as MediaQueryList;
  const matchMedia = vi.fn(() => query);
  const setDark = (dark: boolean) => {
    Object.assign(query, { matches: dark });
    target.dispatchEvent(Object.assign(new Event("change"), { matches: dark }));
  };
  return { matchMedia, setDark };
};

describe("createMediaColorSchemeSource", () => {
  it("reads prefers-color-scheme", () => {
    const { matchMedia } = fakeMatchMedia(true);
    expect(createMediaColorSchemeSource(matchMedia).current()).toBe("dark");
    expect(matchMedia).toHaveBeenCalledWith("(prefers-color-scheme: dark)");
  });

  it("reports changes until unsubscribed", () => {
    const { matchMedia, setDark } = fakeMatchMedia(false);
    const source = createMediaColorSchemeSource(matchMedia);
    const listener = vi.fn();
    const unsubscribe = source.subscribe(listener);

    setDark(true);
    unsubscribe();
    setDark(false);

    expect(listener.mock.calls).toEqual([["dark"]]);
    expect(source.current()).toBe("light");
  });
});
