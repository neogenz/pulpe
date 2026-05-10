import { createZodDto } from 'nestjs-zod';
import { demoCleanupResponseSchema } from 'pulpe-shared';

export class DemoCleanupResponseDto extends createZodDto(
  demoCleanupResponseSchema,
) {}
