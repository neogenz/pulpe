import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { CacheService } from './cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockCache: {
    get: ReturnType<typeof mock>;
    set: ReturnType<typeof mock>;
    del: ReturnType<typeof mock>;
    reset: ReturnType<typeof mock>;
  };
  let mockLogger: {
    info: ReturnType<typeof mock>;
    debug: ReturnType<typeof mock>;
    warn: ReturnType<typeof mock>;
    trace: ReturnType<typeof mock>;
  };

  beforeEach(() => {
    mockCache = {
      get: mock(() => Promise.resolve(undefined)),
      set: mock(() => Promise.resolve()),
      del: mock(() => Promise.resolve()),
      reset: mock(() => Promise.resolve()),
    };
    mockLogger = {
      info: mock(() => {}),
      debug: mock(() => {}),
      warn: mock(() => {}),
      trace: mock(() => {}),
    };
    cacheService = new CacheService(mockCache as any, mockLogger as any);
  });

  describe('getOrSet', () => {
    it('should return cached value on cache hit', async () => {
      const cachedData = { id: '1', name: 'Budget' };
      mockCache.get.mockResolvedValueOnce(cachedData);
      const fetcher = mock(() => Promise.resolve({ id: '2', name: 'New' }));

      const result = await cacheService.getOrSet(
        'user1',
        'budgets:list',
        30000,
        fetcher,
      );

      expect(result).toEqual(cachedData);
      expect(fetcher).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalledWith('cache:user1:budgets:list');
    });

    it('should call fetcher and cache result on cache miss', async () => {
      const fetchedData = { id: '1', name: 'Budget' };
      const fetcher = mock(() => Promise.resolve(fetchedData));

      const result = await cacheService.getOrSet(
        'user1',
        'budgets:list',
        30000,
        fetcher,
      );

      expect(result).toEqual(fetchedData);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        'cache:user1:budgets:list',
        fetchedData,
        30000,
      );
    });

    it('should scope cache keys with userId prefix', async () => {
      await cacheService.getOrSet('user123', 'budgets:detail:abc', 15000, () =>
        Promise.resolve('data'),
      );

      expect(mockCache.get).toHaveBeenCalledWith(
        'cache:user123:budgets:detail:abc',
      );
    });

    it('should treat null cached value as cache miss', async () => {
      mockCache.get.mockResolvedValueOnce(null);
      const fetcher = mock(() => Promise.resolve('fresh'));

      const result = await cacheService.getOrSet('user1', 'key', 5000, fetcher);

      expect(result).toBe('fresh');
      expect(fetcher).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateForUser', () => {
    it('should delete all tracked keys for the user', async () => {
      await cacheService.getOrSet('user1', 'key1', 5000, () =>
        Promise.resolve('a'),
      );
      await cacheService.getOrSet('user1', 'key2', 5000, () =>
        Promise.resolve('b'),
      );

      await cacheService.invalidateForUser('user1');

      expect(mockCache.del).toHaveBeenCalledWith('cache:user1:key1');
      expect(mockCache.del).toHaveBeenCalledWith('cache:user1:key2');
    });

    it('should be a no-op for unknown user', async () => {
      await cacheService.invalidateForUser('unknown-user');

      expect(mockCache.del).not.toHaveBeenCalled();
    });

    it('should not affect other users keys', async () => {
      await cacheService.getOrSet('user1', 'key1', 5000, () =>
        Promise.resolve('a'),
      );
      await cacheService.getOrSet('user2', 'key2', 5000, () =>
        Promise.resolve('b'),
      );

      await cacheService.invalidateForUser('user1');

      expect(mockCache.del).toHaveBeenCalledWith('cache:user1:key1');
      expect(mockCache.del).not.toHaveBeenCalledWith('cache:user2:key2');
    });

    it('should clear tracked keys when exceeding max per user', async () => {
      for (let i = 0; i <= 50; i++) {
        await cacheService.getOrSet('user1', `key${i}`, 5000, () =>
          Promise.resolve(`val${i}`),
        );
      }
      await cacheService.invalidateForUser('user1');
      expect(mockCache.del).toHaveBeenCalledTimes(1);
    });

    it('should clear tracking after invalidation', async () => {
      await cacheService.getOrSet('user1', 'key1', 5000, () =>
        Promise.resolve('a'),
      );
      await cacheService.invalidateForUser('user1');

      mockCache.del.mockClear();
      await cacheService.invalidateForUser('user1');

      expect(mockCache.del).not.toHaveBeenCalled();
    });
  });
});
