import { t } from "@ui/locales/en-shell.ts";

/** First in the tab order and visible only when focused: jumps keyboard users past the top bar and navigation. */
export const SkipLink = ({ targetId }: { targetId: string }) => (
  <a
    href={`#${targetId}`}
    className="sr-only rounded-lg bg-accent px-3 py-2 text-accent-foreground focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50"
  >
    {t("shell.skipToContent")}
  </a>
);
