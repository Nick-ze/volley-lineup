/**
 * v8.3: caches of derived data by object identity (docs/AUDIT.md A1). The store is updated
 * immutably, so an unchanged set or match keeps its objects: their replay, result and stats are
 * reused instead of being recomputed on every store change. Entries are held weakly, so a cache
 * never keeps old data alive.
 *
 * Only for pure functions whose result depends on nothing but the object arguments (the cache key
 * covers every argument). Cached results are shared between callers: they must never be mutated.
 */

/** A cached result (boxed, so `undefined` and `null` results are cached too). */
interface Entry<R> {
  value: R;
}

/** `fn` cached by the identity of its argument. */
export function memoByIdentity<A extends object, R>(fn: (a: A) => R): (a: A) => R {
  const cache = new WeakMap<A, Entry<R>>();
  return (a) => {
    const hit = cache.get(a);
    if (hit) return hit.value;
    const value = fn(a);
    cache.set(a, { value });
    return value;
  };
}

/** `fn` cached by the identity of both arguments (one cache per first argument). */
export function memoByIdentity2<A extends object, B extends object, R>(
  fn: (a: A, b: B) => R,
): (a: A, b: B) => R {
  const cache = new WeakMap<A, (b: B) => R>();
  return (a, b) => {
    let withA = cache.get(a);
    if (!withA) {
      withA = memoByIdentity((x: B) => fn(a, x));
      cache.set(a, withA);
    }
    return withA(b);
  };
}
