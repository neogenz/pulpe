import '@angular/compiler';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserTestingModule,
  platformBrowserTesting,
} from '@angular/platform-browser/testing';
import { registerLocaleData } from '@angular/common';
import localeFrCh from '@angular/common/locales/fr-CH';

// Register Swiss French locale for CurrencyPipe in tests
registerLocaleData(localeFrCh, 'fr-CH');

// Initialize Angular testing environment for Vitest
// Angular v20 modern setup without zone.js (zoneless)
// Using platformBrowserTesting for proper signal inputs support
// Note: errorOnUnknownProperties disabled due to JIT compilation issues with signal inputs
getTestBed().initTestEnvironment(
  BrowserTestingModule,
  platformBrowserTesting(),
  {
    errorOnUnknownElements: true,
    errorOnUnknownProperties: false,
    teardown: { destroyAfterEach: true },
  },
);

// Provide stable in-memory Storage for tests (Vitest/JSDOM storage can be flaky and
// some tests may monkeypatch methods).
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  const storage = {} as Record<string, unknown>;

  Object.defineProperty(storage, 'length', {
    get: () => store.size,
    enumerable: false,
    configurable: true,
  });

  Object.defineProperty(storage, 'clear', {
    value: () => {
      for (const key of store.keys()) {
        delete storage[key];
      }
      store.clear();
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(storage, 'getItem', {
    value: (key: string) => (store.has(key) ? store.get(key)! : null),
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(storage, 'key', {
    value: (index: number) => Array.from(store.keys())[index] ?? null,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(storage, 'removeItem', {
    value: (key: string) => {
      store.delete(key);
      delete storage[key];
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(storage, 'setItem', {
    value: (key: string, value: string) => {
      const normalizedValue = String(value);
      store.set(key, normalizedValue);

      Object.defineProperty(storage, key, {
        value: normalizedValue,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });

  return storage as unknown as Storage;
}

const testLocalStorage = createMemoryStorage();
const testSessionStorage = createMemoryStorage();

Object.defineProperty(window, 'localStorage', {
  value: testLocalStorage,
  configurable: true,
});
Object.defineProperty(window, 'sessionStorage', {
  value: testSessionStorage,
  configurable: true,
});

Object.defineProperty(globalThis, 'localStorage', {
  value: testLocalStorage,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: testSessionStorage,
  configurable: true,
});
