import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, storage } from '../src/storage.js';

/** In-memory stand-in for window.localStorage. */
function fakeLocalStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

describe('createStorage', () => {
  test('reads back what it wrote', () => {
    const backend = fakeLocalStorage();
    const store = createStorage(() => backend);
    assert.equal(store.get('missing'), null);
    assert.equal(store.set('lang', 'tr'), true);
    assert.equal(store.get('lang'), 'tr');
  });

  test('stores values as strings', () => {
    const backend = fakeLocalStorage();
    const store = createStorage(() => backend);
    store.set('count', 3);
    assert.equal(store.get('count'), '3');
  });

  test('does not touch the backend until it is used', () => {
    let lookups = 0;
    const store = createStorage(() => {
      lookups += 1;
      return fakeLocalStorage();
    });
    assert.equal(lookups, 0);
    store.get('x');
    assert.equal(lookups, 1);
  });

  test('survives a backend whose methods throw (quota, private mode)', () => {
    const store = createStorage(() => ({
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('QuotaExceededError');
      },
    }));
    assert.equal(store.get('a'), null);
    assert.equal(store.set('a', 'b'), false);
  });

  test('survives a backend that cannot even be reached', () => {
    const store = createStorage(() => {
      throw new Error('SecurityError');
    });
    assert.equal(store.get('a'), null);
    assert.equal(store.set('a', 'b'), false);
  });

  test('works without any backend (e.g. outside a browser)', () => {
    const store = createStorage(() => undefined);
    assert.equal(store.get('a'), null);
    assert.equal(store.set('a', 'b'), false);
  });

  test('ignores non-string values from a misbehaving backend', () => {
    const store = createStorage(() => ({ getItem: () => 12, setItem() {} }));
    assert.equal(store.get('a'), null);
  });

  test('the shared helper exposes get and set', () => {
    assert.equal(typeof storage.get, 'function');
    assert.equal(typeof storage.set, 'function');
  });
});
