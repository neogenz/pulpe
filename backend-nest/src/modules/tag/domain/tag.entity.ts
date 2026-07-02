import type { Database } from '../../../types/database.types';

export type TagRow = Database['public']['Tables']['tag']['Row'];
export type TagInsert = Database['public']['Tables']['tag']['Insert'];

/**
 * Domain entity for a tag — camelCase, pure plaintext metadata.
 *
 * Repos return this shape. Use cases work with this. The mapper converts to
 * API DTOs. Unlike amount-bearing entities, `name` is plaintext (no
 * ENCRYPTION_PORT involvement) — same posture as `transaction.name`.
 */
export interface Tag {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Repo write input for inserts.
 */
export interface TagCreateInput {
  name: string;
}

/**
 * Repo write patch for partial updates. `undefined` means "do not touch".
 */
export interface TagUpdatePatch {
  name?: string;
}
