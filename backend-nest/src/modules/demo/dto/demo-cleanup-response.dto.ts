import { createZodDto } from 'nestjs-zod';
import { demoCleanupResponseSchema } from '@pulpe/shared';

/**
 * Response DTO for demo cleanup endpoint
 * Returns the count of deleted and failed demo users
 *
 * Schema is defined in @pulpe/shared to maintain type-safety across frontend/backend
 */
export class DemoCleanupResponseDto extends createZodDto(
  demoCleanupResponseSchema,
) {}
