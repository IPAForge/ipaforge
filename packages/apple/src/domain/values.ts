/** The text, or `undefined` when it is empty or absent (Apple often sends `""` for "not set"). */
export const nonEmpty = (value: string | null | undefined): string | undefined => value || undefined;

/** A failure's message for health reports and logs. */
export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));
