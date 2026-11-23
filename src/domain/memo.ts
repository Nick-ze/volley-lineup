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

/**
 * `fn` cached by the identity of both arguments: one inner cache per first argument. The inner
 * cache holds no reference to its own key (no closure over `a`), so entries can be collected.
 */
export function memoByIdentity2<A extends object, B extends object, R>(
  fn: (a: A, b: B) => R,
): (a: A, b: B) => R {
  const cache = new WeakMap<A, WeakMap<B, Entry<R>>>();
  return (a, b) => {
    let inner = cache.get(a);
    if (!inner) {
      inner = new WeakMap<B, Entry<R>>();
      cache.set(a, inner);
    }
    const hit = inner.get(b);
    if (hit) return hit.value;
    const value = fn(a, b);
    inner.set(b, { value });
    return value;
  };
}
