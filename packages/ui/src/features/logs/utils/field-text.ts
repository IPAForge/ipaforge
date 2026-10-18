/** A field's value as shown: strings as they are, anything else as JSON. */
export const fieldText = (value: unknown): string =>
  typeof value === 'string' ? value : (JSON.stringify(value) ?? String(value))
