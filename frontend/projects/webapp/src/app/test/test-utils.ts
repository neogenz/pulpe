import { signal, type ResourceRef, type WritableSignal } from '@angular/core';
import { vi } from 'vitest';

/**
 * Creates a type-safe mock ResourceRef for testing
 * @param initialValue The initial value for the resource
 * @returns A mocked ResourceRef with all required methods
 */
export function createMockResourceRef<T>(initialValue: T): ResourceRef<T> {
  const valueSignal = signal(initialValue) as WritableSignal<T>;
  const mock: ResourceRef<T> = {
    // From Resource<T>
    value: valueSignal,
    status: signal('idle' as const),
    error: signal(undefined),
    isLoading: signal(false),

    // From WritableResource<T>
    hasValue: function (): this is ResourceRef<Exclude<T, undefined>> {
      return valueSignal() !== undefined;
    },
    set: vi.fn((value: T) => valueSignal.set(value)),
    update: vi.fn((updater: (value: T) => T) => valueSignal.update(updater)),
    asReadonly: vi.fn(() => mock),

    // From ResourceRef<T>
    destroy: vi.fn(),
    reload: vi.fn(),
  };
  return mock;
}
