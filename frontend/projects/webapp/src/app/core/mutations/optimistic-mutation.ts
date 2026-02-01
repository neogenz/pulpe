import type { ResourceRef } from '@angular/core';

/**
 * Options for optimistic mutation with automatic rollback on error.
 */
export interface OptimisticMutationOptions<TData, TResponse> {
  resource: ResourceRef<TData>;
  optimisticUpdate?: (data: TData) => TData;
  apiCall: () => Promise<TResponse>;
  reconcile?: (data: TData, response: TResponse) => TData;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

/**
 * Optimistic mutation for low-concurrency scenarios.
 * Pattern: Optimistic update -> API call -> Reconcile -> Success callback
 * On error: Resource reload (rollback) + error callback.
 */
export async function runOptimisticMutation<TData, TResponse>(
  options: OptimisticMutationOptions<TData, TResponse>,
): Promise<void> {
  if (options.optimisticUpdate) {
    options.resource.update((data) =>
      data ? options.optimisticUpdate!(data) : data,
    );
  }

  try {
    const response = await options.apiCall();

    if (options.reconcile) {
      options.resource.update((data) =>
        data ? options.reconcile!(data, response) : data,
      );
    }

    options.onSuccess?.();
  } catch (error) {
    options.resource.reload();
    options.onError?.(error);
  }
}
