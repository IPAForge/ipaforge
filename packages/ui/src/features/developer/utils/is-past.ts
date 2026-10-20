/** Whether a date the Engine sent (a Date, or its ISO text) has passed. */
export const isPast = (value: Date | string | undefined): boolean =>
  value !== undefined && new Date(value).getTime() < Date.now()
