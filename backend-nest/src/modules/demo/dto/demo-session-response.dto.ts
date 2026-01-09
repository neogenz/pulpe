import { createZodDto } from 'nestjs-zod';
import { demoSessionResponseSchema } from 'pulpe-shared';

/**
 * Response DTO for demo session creation
 * Returns a real Supabase session that can be used immediately
 *
 * Schema is defined in pulpe-shared to maintain type-safety across frontend/backend
 */
export class DemoSessionResponseDto extends createZodDto(
  demoSessionResponseSchema,
) {}
