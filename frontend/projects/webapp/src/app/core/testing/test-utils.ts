import { signal, type ResourceRef, type WritableSignal } from '@angular/core';
import { vi } from 'vitest';
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
  signOut: ReturnType<typeof vi.fn>;
  signInWithPassword: ReturnType<typeof vi.fn>;
  signUp: ReturnType<typeof vi.fn>;
  signInWithOAuth: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
  setSession: ReturnType<typeof vi.fn>;
  onAuthStateChange: ReturnType<typeof vi.fn>;
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
