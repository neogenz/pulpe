import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';

@Injectable()
export class CacheService {
  readonly #userKeys = new Map<string, Set<string>>();

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectInfoLogger(CacheService.name) private readonly logger: InfoLogger,
  ) {}

  async getOrSet<T>(
    userId: string,
    key: string,
    ttl: number,
    fetcher: () => Promise<T>,
  ): Promise<T> {
    const fullKey = `cache:${userId}:${key}`;
    const cached = await this.cache.get<T>(fullKey);
    if (cached !== undefined && cached !== null) {
      this.logger.debug({ userId, key }, 'Cache hit');
      return cached;
    }
    this.logger.debug({ userId, key }, 'Cache miss');
    const result = await fetcher();
    await this.cache.set(fullKey, result, ttl);
    this.#trackKey(userId, fullKey);
    return result;
  }

  async invalidateForUser(userId: string): Promise<void> {
    const keys = this.#userKeys.get(userId);
    if (!keys?.size) return;
    const count = keys.size;
    await Promise.all([...keys].map((key) => this.cache.del(key)));
    this.#userKeys.delete(userId);
    this.logger.debug(
      { userId, keysCleared: count },
      'Cache invalidated for user',
    );
  }

  #trackKey(userId: string, fullKey: string): void {
    let keys = this.#userKeys.get(userId);
    if (!keys) {
      keys = new Set();
      this.#userKeys.set(userId, keys);
    }
    keys.add(fullKey);
  }
}
