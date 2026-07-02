import { createZodDto } from 'nestjs-zod';
import {
  tagCreateSchema,
  tagUpdateSchema,
  tagResponseSchema,
  tagListResponseSchema,
  tagDeleteResponseSchema,
} from 'pulpe-shared';

// Swagger DTOs derived from the shared Zod schemas (single source of truth).
export class TagCreateDto extends createZodDto(tagCreateSchema) {}
export class TagUpdateDto extends createZodDto(tagUpdateSchema) {}
export class TagResponseDto extends createZodDto(tagResponseSchema) {}
export class TagListResponseDto extends createZodDto(tagListResponseSchema) {}
export class TagDeleteResponseDto extends createZodDto(
  tagDeleteResponseSchema,
) {}
