import { computed, signal, type ResourceRef, type Signal } from '@angular/core';

interface StaleFallbackConfig<T> {
  readonly resource: ResourceRef<T | undefined>;
}

interface StaleFallback<T> {
  readonly data: Signal<T | null>;
  readonly isLoading: Signal<boolean>;
  readonly isInitialLoading: Signal<boolean>;
  readonly hasValue: Signal<boolean>;
  setStaleData(value: T | null): void;
}

function createStaleFallback<T>(
  config: StaleFallbackConfig<T>,
): StaleFallback<T> {
  const staleData = signal<T | null>(null);

  // Eager-read both signals for dependency tracking — see DR-007 in memory-bank/techContext.md
  const data = computed<T | null>(() => {
    const fresh = config.resource.value();
    const stale = staleData();
    return fresh ?? stale ?? null;
  });

  const isLoading = computed(() => config.resource.isLoading());
  const isInitialLoading = computed(
    () => config.resource.isLoading() && !data(),
  );
  const hasValue = computed(() => !!data());

  return {
    data,
    isLoading,
    isInitialLoading,
    hasValue,
    setStaleData(value: T | null): void {
      staleData.set(value);
    },
  };
}

export { createStaleFallback, type StaleFallback, type StaleFallbackConfig };
