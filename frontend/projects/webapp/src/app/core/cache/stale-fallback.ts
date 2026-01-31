import { computed, signal, type ResourceRef, type Signal } from '@angular/core';

/**
 * Configuration for stale-while-revalidate fallback pattern.
 *
 * @template T - Data type returned by the resource
 */
interface StaleFallbackConfig<T> {
  /**
   * Resource that provides fresh data.
   * Returns T when loaded, undefined when loading or error.
   */
  readonly resource: ResourceRef<T | undefined>;
}

/**
 * Stale-while-revalidate signal that falls back to cached data
 * while the resource is loading.
 *
 * @template T - Data type
 */
interface StaleFallback<T> {
  /**
   * Current data: fresh from resource, or stale from cache, or null if none available.
   *
   * Type transformation:
   * - Resource returns: T | undefined (undefined = loading/error)
   * - Fallback returns: T | null (null = no data available, fresh or stale)
   */
  readonly data: Signal<T | null>;
  readonly isLoading: Signal<boolean>;
  readonly isInitialLoading: Signal<boolean>;
  readonly hasValue: Signal<boolean>;

  /**
   * Manually set stale data to display while resource loads.
   * Typically seeded from a cache before triggering resource load.
   */
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
