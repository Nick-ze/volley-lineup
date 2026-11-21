/**
 * `Widen<T>` turns the `as const` English strings into the shape every language must have:
 * string literals become `string`, functions keep their parameter types and return a widened
 * value, and nested objects keep exactly the same keys. A translation typed as `Strings`
 * therefore fails to compile when a key is missing (or extra), which is the completeness check.
 */
export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? readonly Widen<U>[]
      : T extends object
        ? { readonly [K in keyof T]: Widen<T[K]> }
        : T;
