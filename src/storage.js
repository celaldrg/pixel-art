/**
 * The only place that touches localStorage. Every read and write is wrapped in
 * try/catch, so private mode, blocked cookies or a full quota never crash the app.
 * Nothing is accessed at import time.
 * @module storage
 */

/** @typedef {Pick<Storage, 'getItem' | 'setItem'>} StorageBackend */

/**
 * Creates a safe string key-value store.
 * @param {() => StorageBackend | null | undefined} [getBackend] returns the backend
 *   on each call (default: the browser's localStorage)
 * @returns {{ get(key: string): string|null, set(key: string, value: string): boolean }}
 */
export function createStorage(getBackend = () => globalThis.localStorage) {
  return {
    get(key) {
      try {
        const value = getBackend()?.getItem(key);
        return typeof value === 'string' ? value : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        const backend = getBackend();
        if (!backend) return false;
        backend.setItem(key, String(value));
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** Shared store backed by window.localStorage (resolved lazily). */
export const storage = createStorage();
