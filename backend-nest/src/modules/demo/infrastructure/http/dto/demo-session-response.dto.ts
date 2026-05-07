import { createZodDto } from 'nestjs-zod';
import { demoSessionResponseSchema } from 'pulpe-shared';

export class DemoSessionResponseDto extends createZodDto(
  demoSessionResponseSchema,
) {}
