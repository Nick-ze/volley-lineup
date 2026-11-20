/**
 * Persisted store versioning. When the persisted shape changes:
 * 1. bump STORE_VERSION, 2. add a `case` that upgrades from the previous version.
 */
export const STORE_VERSION = 1;

export function migrateStore(persisted: unknown, fromVersion: number): unknown {
  // v1 is the first version; nothing to migrate yet.
  if (fromVersion > STORE_VERSION) {
    throw new Error(
      `Stored data version ${fromVersion} is newer than this app (${STORE_VERSION}).`,
    );
  }
  return persisted;
}
