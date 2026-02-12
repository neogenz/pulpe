import { z, type ZodTypeAny } from 'zod';

/**
 * Factory for success response schemas: { success: true, data: T }
 * Replaces manual `z.object({ success: z.literal(true), data: someSchema })` patterns.
 */
export function createSuccessResponse<T extends ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

/**
 * Factory for list response schemas: { success: true, data: T[] }
 */
export function createListResponse<T extends ZodTypeAny>(itemSchema: T) {
  return z.object({
    success: z.literal(true),
    data: z.array(itemSchema),
  });
}
