import * as Crypto from 'expo-crypto';

let fallbackCounter = 0;

/** Generate a unique id (UUID v4). Falls back to a time-based id if crypto is unavailable. */
export function createId(): string {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === 'string' && id.length > 0) return id;
  } catch {
    // fall through to the fallback below
  }
  fallbackCounter += 1;
  return `id-${Date.now().toString(36)}-${fallbackCounter}-${Math.random().toString(36).slice(2, 10)}`;
}
