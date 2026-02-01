import type { ResourceRef } from '@angular/core';
import { describe, it, expect, vi } from 'vitest';
import { runOptimisticMutation } from './optimistic-mutation';

function createMockResource<T>(initialValue: T): ResourceRef<T> {
  let value = initialValue;
  return {
    value: () => value,
    hasValue: () => true,
    update: vi.fn((fn: (data: T | undefined) => T | undefined) => {
      const result = fn(value);
      if (result !== undefined) value = result as T;
    }),
    set: vi.fn((data: T) => {
      value = data;
    }),
    reload: vi.fn(),
    error: () => undefined,
    isLoading: () => false,
    status: () => 'resolved' as const,
    destroy: vi.fn(),
    asReadonly: vi.fn(),
  } as unknown as ResourceRef<T>;
}

describe('runOptimisticMutation', () => {
  it('applies optimistic update before API call', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => ({ count: 5 }));

    await runOptimisticMutation({
      resource,
      optimisticUpdate: (data) => ({ count: data.count + 1 }),
      apiCall,
    });

    expect(resource.update).toHaveBeenCalledWith(expect.any(Function));
  });

  it('calls reconcile after successful API call', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => ({ count: 5 }));
    const reconcile = vi.fn((data, response) => ({ count: response.count }));

    await runOptimisticMutation({
      resource,
      apiCall,
      reconcile,
    });

    expect(reconcile).toHaveBeenCalledWith({ count: 0 }, { count: 5 });
    expect(resource.update).toHaveBeenCalledWith(expect.any(Function));
  });

  it('calls onSuccess after successful mutation', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => ({ count: 5 }));
    const onSuccess = vi.fn();

    await runOptimisticMutation({
      resource,
      apiCall,
      onSuccess,
    });

    expect(onSuccess).toHaveBeenCalled();
  });

  it('reloads resource on error (rollback)', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => {
      throw new Error('API error');
    });

    await runOptimisticMutation({
      resource,
      apiCall,
    });

    expect(resource.reload).toHaveBeenCalled();
  });

  it('calls onError on failure', async () => {
    const resource = createMockResource({ count: 0 });
    const error = new Error('API error');
    const apiCall = vi.fn(async () => {
      throw error;
    });
    const onError = vi.fn();

    await runOptimisticMutation({
      resource,
      apiCall,
      onError,
    });

    expect(onError).toHaveBeenCalledWith(error);
  });

  it('does NOT re-throw error (swallows it)', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => {
      throw new Error('API error');
    });

    await expect(
      runOptimisticMutation({
        resource,
        apiCall,
      }),
    ).resolves.toBeUndefined();
  });

  it('works without optimisticUpdate (API-first)', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => ({ count: 5 }));
    const reconcile = vi.fn((data, response) => ({ count: response.count }));

    await runOptimisticMutation({
      resource,
      apiCall,
      reconcile,
    });

    expect(apiCall).toHaveBeenCalled();
    expect(reconcile).toHaveBeenCalled();
  });

  it('works without reconcile (fire-and-forget)', async () => {
    const resource = createMockResource({ count: 0 });
    const apiCall = vi.fn(async () => ({ count: 5 }));
    const optimisticUpdate = vi.fn((data) => ({ count: data.count + 1 }));

    await runOptimisticMutation({
      resource,
      apiCall,
      optimisticUpdate,
    });

    expect(apiCall).toHaveBeenCalled();
    expect(optimisticUpdate).toHaveBeenCalled();
  });
});
