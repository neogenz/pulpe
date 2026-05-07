import { createZodDto } from 'nestjs-zod';
import { demoSessionCreateSchema } from 'pulpe-shared';

export class CreateDemoSessionDto extends createZodDto(
  demoSessionCreateSchema,
) {}
