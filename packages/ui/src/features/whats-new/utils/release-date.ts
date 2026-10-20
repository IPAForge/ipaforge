/** A `YYYY-MM-DD` release date as a local date, so formatting it shows that day everywhere. */
export const releaseDate = (date: string): Date => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)

  return new Date(year, month - 1, day)
}
