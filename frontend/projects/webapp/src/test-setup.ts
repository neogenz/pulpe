// Runs before every spec, under `@angular/build:unit-test`. The builder owns
// `initTestEnvironment` and compiles the specs ahead of time, so this file only
// carries what the runtime still lacks.
import { registerLocaleData } from '@angular/common';
import localeFrCh from '@angular/common/locales/fr-CH';
import localeDeCh from '@angular/common/locales/de-CH';
import localeFR from '@angular/common/locales/fr';

// Register locales for CurrencyPipe / AppCurrencyPipe in tests
registerLocaleData(localeFrCh, 'fr-CH');
registerLocaleData(localeDeCh, 'de-CH');
registerLocaleData(localeFR, 'fr-FR');

// jsdom ships no 2D canvas. `ng2-charts` asks for a context the moment its
// directive is constructed, which now happens for real: the specs compile ahead
// of time, so a chart inside a component under test is instantiated rather than
// skipped. Nothing reads what is drawn — the stub only has to not throw.
HTMLCanvasElement.prototype.getContext = (() =>
  null) as HTMLCanvasElement['getContext'];

// jsdom ships no IntersectionObserver either, and two paths now reach for one:
// `main-layout`'s scroll sentinel, and the `@defer (on viewport)` blocks in
// `current-month`. Both register from `afterNextRender`, so whether they run
// before teardown depends on how loaded the machine is — which made this an
// error that only surfaced when the four packages' suites ran at once. No spec
// asserts on viewport behaviour, so observing nothing is the correct stub.
const NoopIntersectionObserver = class {
  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds: readonly number[] = [];
  observe = (): void => undefined;
  unobserve = (): void => undefined;
  disconnect = (): void => undefined;
  takeRecords = (): IntersectionObserverEntry[] => [];
} as unknown as typeof IntersectionObserver;

globalThis.IntersectionObserver = NoopIntersectionObserver;
window.IntersectionObserver = NoopIntersectionObserver;

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
