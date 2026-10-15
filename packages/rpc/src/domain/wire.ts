// What a value looks like after crossing the channel. Structured clone keeps data (Maps, Dates, bytes) but refuses
// functions, so they are dropped first: a FileSource in a run's state arrives as `{ name, size }`.

type Primitive = string | number | boolean | bigint | symbol | null | undefined;

type AnyFunction = (...args: never[]) => unknown;

export type Wire<T> = T extends Primitive | Date | Uint8Array
  ? T
  : T extends AnyFunction
    ? never
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<K, Wire<V>>
      : T extends readonly (infer U)[]
        ? readonly Wire<U>[]
        : { readonly [K in keyof T as T[K] extends AnyFunction ? never : K]: Wire<T[K]> };

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const wireEntries = (value: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([, field]) => typeof field !== "function")
      .map(([key, field]) => [key, toWire(field)]),
  );

/** A copy of `value` without functions, safe to send; anything else (Dates, bytes, errors) is left to the clone. */
export const toWire = <T>(value: T): Wire<T> => {
  if (Array.isArray(value)) return value.map(toWire) as Wire<T>;
  if (value instanceof Map) return new Map([...value].map(([key, field]) => [key, toWire(field)])) as Wire<T>;
  if (isPlainObject(value)) return wireEntries(value) as Wire<T>;
  return value as Wire<T>;
};
