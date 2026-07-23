import { createZodDto } from 'nestjs-zod';
import { whatsNewQuerySchema, whatsNewResponseSchema } from 'pulpe-shared';

export class WhatsNewQueryDto extends createZodDto(whatsNewQuerySchema) {}

export class WhatsNewResponseDto extends createZodDto(whatsNewResponseSchema) {}
