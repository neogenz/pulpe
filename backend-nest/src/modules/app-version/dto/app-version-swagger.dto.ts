import { createZodDto } from 'nestjs-zod';
import { appVersionResponseSchema } from 'pulpe-shared';

export class AppVersionResponseDto extends createZodDto(
  appVersionResponseSchema,
) {}
