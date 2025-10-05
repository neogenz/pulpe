import { createZodDto } from 'nestjs-zod';
import { demoSessionCreateSchema } from '@pulpe/shared';

/**
 * DTO for creating a demo session
 *
 * Schema is defined in @pulpe/shared to maintain type-safety across frontend/backend
 *
 * @property turnstileToken - Cloudflare Turnstile response token from the client
 */
export class CreateDemoSessionDto extends createZodDto(
  demoSessionCreateSchema,
) {}
