import {
  computed,
  signal,
  type ResourceRef,
  type WritableSignal,
} from '@angular/core';
import { vi, type Mock } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Typed result for Supabase signOut operation
 */
export type SignOutResult = { error: null } | { error: Error };

/**
 * Typed result for Supabase auth operations that return session
 */
export type AuthSessionResult =
  | {
      data: { session: null; user: null };
      error: Error;
    }
  | {
      data: { session: Session; user: User };
      error: null;
    };

/**
 * Mock interface for Supabase auth methods
 */
export interface MockSupabaseAuth {
  signOut: Mock;
  signInWithPassword: Mock;
  signUp: Mock;
  signInWithOAuth: Mock;
  getSession: Mock;
  refreshSession: Mock;
  setSession: Mock;
  onAuthStateChange: Mock;
}

/**
 * Mock interface for Supabase client
 */
export interface MockSupabaseClient {
  auth: MockSupabaseAuth;
}

/**
 * Creates a type-safe mock Supabase client for testing
 * @returns A mocked SupabaseClient with all auth methods as vi.fn()
 */
export function createMockSupabaseClient(): MockSupabaseClient {
  return {
    auth: {
      signOut: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      setSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
  };
}

/**
 * Mock interface for a ngx-ziflux `DataCache`.
 *
 * `_fetch` and `_settle` are `@internal` in ngx-ziflux and stripped from its
 * published types, yet `cachedResource` calls them on every load. They have to
 * be stubbed here and cannot be checked against the real `DataCache` type, so
 * call sites cast this mock at the injection point.
 */
export interface MockDataCache {
  get: Mock;
  set: Mock;
  has: Mock;
  invalidate: Mock;
  deduplicate: Mock;
  prefetch: Mock;
  clear: Mock;
  _fetch: Mock;
  _settle: Mock;
  version: WritableSignal<number>;
  _dataVersion: WritableSignal<number>;
}

/**
 * Creates a mock DataCache carrying everything `cachedResource` and
 * `cachedMutation` reach for: both version signals, the read/write methods, and
 * the internal fetch pair.
 *
 * `_fetch` delegates to `deduplicate`, mirroring ngx-ziflux where `_fetch` is
 * `deduplicate()` plus the record `_settle()` reads. A spec overriding
 * `deduplicate` therefore still controls what the loader resolves with.
 */
export function createMockDataCache(): MockDataCache {
  const mock: MockDataCache = {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    has: vi.fn().mockReturnValue(false),
    invalidate: vi.fn(),
    deduplicate: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
    prefetch: vi.fn((_key: string[], fn: () => Promise<unknown>) => fn()),
    clear: vi.fn(),
    _fetch: vi.fn(async (key: string[], fn: () => Promise<unknown>) => ({
      data: await mock.deduplicate(key, fn),
      record: { promise: Promise.resolve(), raced: false, superseded: false },
    })),
    // Mirrors the real `_settle`, which writes through to `set()`, so specs
    // asserting on `set` keep observing the same calls they did before 0.2.0.
    _settle: vi.fn((key: string[], result: { data: unknown }, write = true) => {
      if (write) mock.set(key, result.data);
    }),
    version: signal(0),
    _dataVersion: signal(0),
  };
  return mock;
}

/**
 * Creates a type-safe mock ResourceRef for testing
 * @param initialValue The initial value for the resource
 * @returns A mocked ResourceRef with all required methods
 */
export function createMockResourceRef<T>(initialValue: T): ResourceRef<T> {
  const valueSignal = signal(initialValue) as WritableSignal<T>;
  const mock: ResourceRef<T> = {
    // From Resource<T>
    value: valueSignal,
    status: signal('idle' as const),
    error: signal(undefined),
    isLoading: signal(false),
    snapshot: computed(() => ({
      status: 'idle' as const,
      value: valueSignal(),
    })),

    // From WritableResource<T>
    hasValue: function (): this is ResourceRef<Exclude<T, undefined>> {
      return valueSignal() !== undefined;
    },
    set: vi.fn((value: T) => valueSignal.set(value)),
    update: vi.fn((updater: (value: T) => T) => valueSignal.update(updater)),
    asReadonly: vi.fn(() => mock),

    // From ResourceRef<T>
    destroy: vi.fn(),
    reload: vi.fn(),
  };
  return mock;
}
