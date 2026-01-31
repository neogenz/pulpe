import { describe, it, expect } from 'vitest';
import { signal, type ResourceRef } from '@angular/core';
import { createStaleFallback } from './stale-fallback';

function createMockResource<T>() {
  const value = signal<T | undefined>(undefined);
  const isLoading = signal(false);

  return {
    resource: {
      value: value.asReadonly(),
      isLoading: isLoading.asReadonly(),
    } as unknown as ResourceRef<T | undefined>,
    setValue: (v: T | undefined) => value.set(v),
    setIsLoading: (v: boolean) => isLoading.set(v),
  };
}

describe('createStaleFallback', () => {
  it('should return null when no resource value and no stale data', () => {
    const { resource } = createMockResource<string>();
    const swr = createStaleFallback({ resource });

    expect(swr.data()).toBeNull();
    expect(swr.hasValue()).toBe(false);
  });

  it('should return stale data when resource has no value', () => {
    const { resource } = createMockResource<string>();
    const swr = createStaleFallback({ resource });

    swr.setStaleData('stale');

    expect(swr.data()).toBe('stale');
    expect(swr.hasValue()).toBe(true);
  });

  it('should prioritize resource value over stale data', () => {
    const { resource, setValue } = createMockResource<string>();
    const swr = createStaleFallback({ resource });

    swr.setStaleData('stale');
    setValue('fresh');

    expect(swr.data()).toBe('fresh');
  });

  it('should report isInitialLoading when loading without any data', () => {
    const { resource, setIsLoading } = createMockResource<string>();
    const swr = createStaleFallback({ resource });

    setIsLoading(true);

    expect(swr.isInitialLoading()).toBe(true);
    expect(swr.isLoading()).toBe(true);
  });

  it('should not report isInitialLoading when stale data is available', () => {
    const { resource, setIsLoading } = createMockResource<string>();
    const swr = createStaleFallback({ resource });

    swr.setStaleData('stale');
    setIsLoading(true);

    expect(swr.isInitialLoading()).toBe(false);
    expect(swr.isLoading()).toBe(true);
  });
});
