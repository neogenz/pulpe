import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataCache } from './data-cache';

describe('DataCache', () => {
  let cache: DataCache;

  beforeEach(() => {
    cache = new DataCache({ freshTime: 1000, gcTime: 5000 });
  });

  it('should return null on cache miss', () => {
    expect(cache.get(['unknown'])).toBeNull();
  });

  it('should return fresh data after set', () => {
    cache.set(['budget', 'list'], [{ id: '1' }]);

    const result = cache.get<{ id: string }[]>(['budget', 'list']);
    expect(result).toEqual({ data: [{ id: '1' }], fresh: true });
  });

  it('should mark entry as stale after freshTime', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    cache.set(['budget', 'list'], 'data');

    vi.spyOn(Date, 'now').mockReturnValue(now + 1001);

    const result = cache.get(['budget', 'list']);
    expect(result).toEqual({ data: 'data', fresh: false });
  });

  it('should evict entry after gcTime', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    cache.set(['budget', 'list'], 'data');

    vi.spyOn(Date, 'now').mockReturnValue(now + 5001);

    expect(cache.get(['budget', 'list'])).toBeNull();
  });

  it('should invalidate exact key (mark stale, not delete)', () => {
    cache.set(['budget', 'list'], 'data');

    cache.invalidate(['budget', 'list']);

    const result = cache.get(['budget', 'list']);
    expect(result).not.toBeNull();
    expect(result!.fresh).toBe(false);
  });

  it('should invalidate by prefix (mark all matching entries stale)', () => {
    cache.set(['budget', 'list'], 'list-data');
    cache.set(['budget', 'details', '1'], 'details-data');

    cache.invalidate(['budget']);

    expect(cache.get(['budget', 'list'])!.fresh).toBe(false);
    expect(cache.get(['budget', 'details', '1'])!.fresh).toBe(false);
  });

  it('should NOT invalidate non-matching keys', () => {
    cache.set(['budget', 'list'], 'budget-data');
    cache.set(['transaction', 'list'], 'transaction-data');

    cache.invalidate(['budget']);

    expect(cache.get(['transaction', 'list'])!.fresh).toBe(true);
  });

  it('should deduplicate concurrent requests', async () => {
    const fetchFn = vi.fn().mockResolvedValue('result');

    const [result1, result2] = await Promise.all([
      cache.deduplicate(['key'], fetchFn),
      cache.deduplicate(['key'], fetchFn),
    ]);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result1).toBe('result');
    expect(result2).toBe('result');
  });

  it('should auto-cache result after deduplicate resolves', async () => {
    await cache.deduplicate(['key'], () => Promise.resolve('data'));

    const cached = cache.get<string>(['key']);
    expect(cached).toEqual({ data: 'data', fresh: true });
  });

  it('should clean up inFlight after resolution', async () => {
    const fetchFn = vi.fn().mockResolvedValue('result');

    await cache.deduplicate(['key'], fetchFn);

    const fetchFn2 = vi.fn().mockResolvedValue('result2');
    const result = await cache.deduplicate(['key'], fetchFn2);

    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(result).toBe('result2');
  });

  it('should clear matching in-flight promises on invalidate', async () => {
    let resolveFetch!: (value: string) => void;
    const fetchFn = vi
      .fn()
      .mockImplementation(() => new Promise<string>((r) => (resolveFetch = r)));

    cache.deduplicate(['budget', 'list'], fetchFn);

    cache.invalidate(['budget']);

    const fetchFn2 = vi.fn().mockResolvedValue('fresh');
    const result = await cache.deduplicate(['budget', 'list'], fetchFn2);

    expect(fetchFn2).toHaveBeenCalledTimes(1);
    expect(result).toBe('fresh');

    resolveFetch('stale');
  });

  it('should not delete newer in-flight promise when old promise resolves after invalidation', async () => {
    let resolveA!: (value: string) => void;
    const fetchA = vi
      .fn()
      .mockImplementation(() => new Promise<string>((r) => (resolveA = r)));

    let resolveB!: (value: string) => void;
    const fetchB = vi
      .fn()
      .mockImplementation(() => new Promise<string>((r) => (resolveB = r)));

    const fetchC = vi.fn().mockResolvedValue('C');

    // T=0: Start fetch A
    cache.deduplicate(['key'], fetchA);

    // T=1: Invalidate → removes A from inFlight
    cache.invalidate(['key']);

    // T=2: Start fetch B (new promise stored in inFlight)
    cache.deduplicate(['key'], fetchB);

    // T=3: A resolves → its finally() must NOT delete B's promise
    resolveA('stale-A');
    await Promise.resolve();

    // T=4: Another caller should reuse B, not start C
    cache.deduplicate(['key'], fetchC);
    expect(fetchC).not.toHaveBeenCalled();

    resolveB('fresh-B');
  });

  it('should not cache stale response when invalidation happened during fetch', async () => {
    let resolveA!: (value: string) => void;
    const fetchA = vi
      .fn()
      .mockImplementation(() => new Promise<string>((r) => (resolveA = r)));

    // T=0: Start fetch A
    cache.deduplicate(['key'], fetchA);

    // T=1: Invalidate → version bumped
    cache.invalidate(['key']);

    // T=2: Fetch A resolves with stale data → auto-cache must be rejected
    resolveA('stale');
    await Promise.resolve();
    await Promise.resolve();

    const cached = cache.get<string>(['key']);
    expect(cached?.fresh).not.toBe(true);
  });

  it('should cache post-invalidation fetch but not pre-invalidation fetch', async () => {
    let resolveA!: (value: string) => void;
    const fetchA = vi
      .fn()
      .mockImplementation(() => new Promise<string>((r) => (resolveA = r)));

    // T=0: Start fetch A
    cache.deduplicate(['key'], fetchA);

    // T=1: Invalidate
    cache.invalidate(['key']);

    // T=2: Start fetch B (post-invalidation)
    const resultB = await cache.deduplicate(['key'], () =>
      Promise.resolve('fresh-B'),
    );

    expect(resultB).toBe('fresh-B');

    // B's result should be cached as fresh
    const cachedAfterB = cache.get<string>(['key']);
    expect(cachedAfterB).toEqual({ data: 'fresh-B', fresh: true });

    // T=3: Old fetch A finally resolves — must NOT overwrite fresh B
    resolveA('stale-A');
    await Promise.resolve();
    await Promise.resolve();

    const cachedAfterA = cache.get<string>(['key']);
    expect(cachedAfterA).toEqual({ data: 'fresh-B', fresh: true });
  });

  it('should NOT clear non-matching in-flight promises on invalidate', async () => {
    const fetchFn = vi
      .fn()
      .mockImplementation(() => new Promise<string>(() => void 0));

    cache.deduplicate(['transaction', 'list'], fetchFn);

    cache.invalidate(['budget']);

    cache.deduplicate(['transaction', 'list'], fetchFn);

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('should clear all entries and inFlight', () => {
    cache.set(['a'], 1);
    cache.set(['b'], 2);

    cache.clear();

    expect(cache.has(['a'])).toBe(false);
    expect(cache.has(['b'])).toBe(false);
  });
});
