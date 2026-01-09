import { createZodDto } from 'nestjs-zod';
import {
  authValidationResponseSchema,
  authErrorResponseSchema,
} from 'pulpe-shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class AuthValidationResponseDto extends createZodDto(
  authValidationResponseSchema,
) {}
export class AuthErrorResponseDto extends createZodDto(
  authErrorResponseSchema,
) {}
