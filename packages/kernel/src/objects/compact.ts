// `compact({ a, b: maybe })` drops undefined fields. With `exactOptionalPropertyTypes`, an optional field may be
// absent but not `undefined`; this keeps object literals readable instead of `...(b ? { b } : {})` everywhere.

type RequiredKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? never : K }[keyof T];
type MaybeKeys<T> = { [K in keyof T]-?: undefined extends T[K] ? K : never }[keyof T];

/** `T` with every field that may be `undefined` turned into an optional field without `undefined`. */
export type Compact<T> = { [K in RequiredKeys<T>]: T[K] } & {
  [K in MaybeKeys<T>]?: Exclude<T[K], undefined>;
} extends infer O
  ? { [K in keyof O]: O[K] }
  : never;

export const compact = <T extends object>(value: T): Compact<T> => {
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) if (field !== undefined) out[key] = field;
  return out as Compact<T>;
};
