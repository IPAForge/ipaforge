import { directionOf } from "@ui/utils/i18n/languages.ts";

/** Marks `root` (normally `<html>`) with the locale's language and writing direction. */
export const applyLocale = (root: HTMLElement, locale: string): void => {
  root.setAttribute("lang", locale);
  root.setAttribute("dir", directionOf(locale));
};
