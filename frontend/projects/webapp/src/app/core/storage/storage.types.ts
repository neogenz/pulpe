import type { ZodSchema } from 'zod';

/**
 * Type-safe storage key that MUST start with 'pulpe-' or 'pulpe_' prefix.
 * This ensures all app storage keys are cleaned on logout.
 */
export type StorageKey = `pulpe-${string}` | `pulpe_${string}`;

/**
 * Versioned wrapper for storage values.
 * Every stored value is wrapped with version and timestamp for migration support.
 */
export interface StorageEntry<T> {
  version: number;
  data: T;
  updatedAt: string;
}

/**
 * Scope defines cleanup behavior:
 * - 'user': Cleared on logout (user-specific data)
 * - 'app': Preserved across sessions (device/app settings)
 */
export type StorageScope = 'user' | 'app';

/**
 * Configuration for a storage key including schema validation and scope.
 */
export interface StorageSchemaConfig<T = unknown> {
  version: number;
  schema: ZodSchema<T>;
  scope: StorageScope;
}

/**
 * Migration function to transform data from one version to another.
 */
export interface Migration<TFrom = unknown, TTo = unknown> {
  fromVersion: number;
  toVersion: number;
  migrate: (oldData: TFrom) => TTo;
}

/**
 * Type helper to extract the data type from a StorageSchemaConfig.
 */
export type InferStorageData<T extends StorageSchemaConfig> =
  T extends StorageSchemaConfig<infer U> ? U : never;

/**
 * Type guard: checks if value is a versioned StorageEntry.
 */
export function isStorageEntry(value: unknown): value is StorageEntry<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    'data' in value &&
    'updatedAt' in value &&
    typeof (value as StorageEntry<unknown>).version === 'number'
  );
}
