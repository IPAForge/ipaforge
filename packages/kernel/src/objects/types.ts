export type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K
}[keyof T]

export type MaybeKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? K : never
}[keyof T]

/** `T` with every field that may be `undefined` turned into an optional field without `undefined`. */
export type Compact<T> = { [K in RequiredKeys<T>]: T[K] } & {
  [K in MaybeKeys<T>]?: Exclude<T[K], undefined>
} extends infer O
  ? { [K in keyof O]: O[K] }
  : never
