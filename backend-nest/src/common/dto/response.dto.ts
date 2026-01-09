import { createZodDto } from 'nestjs-zod';
import { errorResponseSchema, deleteResponseSchema } from 'pulpe-shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class ErrorResponseDto extends createZodDto(errorResponseSchema) {}
export class DeleteResponseDto extends createZodDto(deleteResponseSchema) {}
