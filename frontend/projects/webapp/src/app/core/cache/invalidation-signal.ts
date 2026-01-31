import { signal, type Signal } from '@angular/core';

interface InvalidationSignal {
  readonly version: Signal<number>;
  invalidate(): void;
}

function createInvalidationSignal(): InvalidationSignal {
  const version = signal(0);

  return {
    version: version.asReadonly(),
    invalidate(): void {
      version.update((v) => v + 1);
    },
  };
}

export { createInvalidationSignal, type InvalidationSignal };
