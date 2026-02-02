import { computed, signal, type Signal } from '@angular/core';

interface ListCacheConfig<T> {
  readonly fetcher: () => Promise<T[]>;
  readonly label: string;
  readonly onError?: (error: unknown) => void;
}

interface ListCache<T> {
  readonly data: Signal<T[] | null>;
  readonly isLoading: Signal<boolean>;
  readonly hasData: Signal<boolean>;
  preload(): Promise<T[]>;
  invalidate(): void;
  clear(): void;
}

function createListCache<T>(config: ListCacheConfig<T>): ListCache<T> {
  const data = signal<T[] | null>(null);
  const isLoading = signal(false);
  const hasData = computed(() => data() !== null);
  let loadPromise: Promise<T[]> | null = null;

  async function fetchData(): Promise<T[]> {
    isLoading.set(true);
    try {
      const result = await config.fetcher();
      data.set(result);
      return result;
    } catch (error) {
      config.onError?.(error);
      return [];
    } finally {
      isLoading.set(false);
      loadPromise = null;
    }
  }

  function preload(): Promise<T[]> {
    const cached = data();
    if (cached !== null) return Promise.resolve(cached);
    if (loadPromise) return loadPromise;

    loadPromise = fetchData();
    return loadPromise;
  }

  function invalidate(): void {
    data.set(null);
  }

  function clear(): void {
    data.set(null);
    isLoading.set(false);
    loadPromise = null;
  }

  return {
    data: data.asReadonly(),
    isLoading: isLoading.asReadonly(),
    hasData,
    preload,
    invalidate,
    clear,
  };
}

export { createListCache, type ListCache, type ListCacheConfig };
