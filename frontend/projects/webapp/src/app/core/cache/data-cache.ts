export interface DataCacheConfig {
  freshTime: number;
  gcTime: number;
}

interface CacheEntry {
  data: unknown;
  createdAt: number;
}

export class DataCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #inFlight = new Map<string, Promise<unknown>>();
  readonly #versions = new Map<string, number>();
  readonly #config: DataCacheConfig;

  constructor(config: DataCacheConfig) {
    this.#config = config;
  }

  get<T>(key: string[]): { data: T; fresh: boolean } | null {
    const serialized = JSON.stringify(key);
    const entry = this.#entries.get(serialized);
    if (!entry) return null;

    const age = Date.now() - entry.createdAt;
    if (age > this.#config.gcTime) {
      this.#entries.delete(serialized);
      return null;
    }

    return { data: entry.data as T, fresh: age <= this.#config.freshTime };
  }

  set<T>(key: string[], data: T): void {
    this.#entries.set(JSON.stringify(key), { data, createdAt: Date.now() });
  }

  has(key: string[]): boolean {
    return this.get(key) !== null;
  }

  invalidate(keyPrefix: string[]): void {
    const prefix = JSON.stringify(keyPrefix).slice(0, -1);
    for (const key of this.#entries.keys()) {
      if (key.startsWith(prefix)) {
        const entry = this.#entries.get(key)!;
        entry.createdAt = Date.now() - this.#config.freshTime - 1;
        this.#bumpVersion(key);
      }
    }
    for (const key of this.#inFlight.keys()) {
      if (key.startsWith(prefix)) {
        this.#inFlight.delete(key);
        this.#bumpVersion(key);
      }
    }
  }

  clear(): void {
    this.#entries.clear();
    this.#inFlight.clear();
    this.#versions.clear();
  }

  deduplicate<T>(key: string[], fetchFn: () => Promise<T>): Promise<T> {
    const serialized = JSON.stringify(key);
    const existing = this.#inFlight.get(serialized);
    if (existing) return existing as Promise<T>;

    const versionAtStart = this.#versions.get(serialized) ?? 0;

    const promise = fetchFn()
      .then((result) => {
        const currentVersion = this.#versions.get(serialized) ?? 0;
        if (currentVersion === versionAtStart) {
          this.#entries.set(serialized, {
            data: result,
            createdAt: Date.now(),
          });
        }
        return result;
      })
      .finally(() => {
        if (this.#inFlight.get(serialized) === promise) {
          this.#inFlight.delete(serialized);
        }
      });
    this.#inFlight.set(serialized, promise);
    return promise;
  }

  #bumpVersion(serialized: string): void {
    this.#versions.set(serialized, (this.#versions.get(serialized) ?? 0) + 1);
  }
}
