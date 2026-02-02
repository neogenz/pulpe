import { describe, it, expect, vi } from 'vitest';
import { createListCache } from './list-cache';

describe('createListCache', () => {
  it('should have null data, false isLoading, false hasData initially', () => {
    const cache = createListCache({
      fetcher: () => Promise.resolve([]),
      label: 'test',
    });

    expect(cache.data()).toBeNull();
    expect(cache.isLoading()).toBe(false);
    expect(cache.hasData()).toBe(false);
  });

  it('should call fetcher and store result on preload', async () => {
    const items = [{ id: 1 }, { id: 2 }];
    const fetcher = vi.fn().mockResolvedValue(items);
    const cache = createListCache({ fetcher, label: 'test' });

    const result = await cache.preload();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(items);
    expect(cache.data()).toEqual(items);
    expect(cache.hasData()).toBe(true);
  });

  it('should return cached data without fetching on second preload', async () => {
    const items = [{ id: 1 }];
    const fetcher = vi.fn().mockResolvedValue(items);
    const cache = createListCache({ fetcher, label: 'test' });

    await cache.preload();
    const result = await cache.preload();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result).toEqual(items);
  });

  it('should deduplicate concurrent preload calls', async () => {
    const items = [{ id: 1 }];
    const fetcher = vi.fn().mockResolvedValue(items);
    const cache = createListCache({ fetcher, label: 'test' });

    const [result1, result2] = await Promise.all([
      cache.preload(),
      cache.preload(),
    ]);

    expect(fetcher).toHaveBeenCalledOnce();
    expect(result1).toEqual(items);
    expect(result2).toEqual(items);
  });

  it('should call onError and return empty array on fetch error', async () => {
    const error = new Error('fetch failed');
    const onError = vi.fn();
    const cache = createListCache({
      fetcher: () => Promise.reject(error),
      label: 'test',
      onError,
    });

    const result = await cache.preload();

    expect(onError).toHaveBeenCalledWith(error);
    expect(result).toEqual([]);
    expect(cache.data()).toBeNull();
  });

  it('should set isLoading to true during fetch and false after', async () => {
    let resolvePromise!: (value: string[]) => void;
    const fetcher = () =>
      new Promise<string[]>((resolve) => {
        resolvePromise = resolve;
      });
    const cache = createListCache({ fetcher, label: 'test' });

    const promise = cache.preload();
    expect(cache.isLoading()).toBe(true);

    resolvePromise(['a']);
    await promise;
    expect(cache.isLoading()).toBe(false);
  });

  it('should set data to null on invalidate', async () => {
    const cache = createListCache({
      fetcher: () => Promise.resolve([1, 2]),
      label: 'test',
    });

    await cache.preload();
    expect(cache.hasData()).toBe(true);

    cache.invalidate();

    expect(cache.data()).toBeNull();
    expect(cache.hasData()).toBe(false);
  });

  it('should re-fetch after invalidate', async () => {
    const fetcher = vi.fn().mockResolvedValue([1]);
    const cache = createListCache({ fetcher, label: 'test' });

    await cache.preload();
    cache.invalidate();
    await cache.preload();

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('should reset all state on clear', async () => {
    const fetcher = vi.fn().mockResolvedValue([1]);
    const cache = createListCache({ fetcher, label: 'test' });

    await cache.preload();

    cache.clear();

    expect(cache.data()).toBeNull();
    expect(cache.isLoading()).toBe(false);
    expect(cache.hasData()).toBe(false);
  });
});
