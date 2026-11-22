import { createZodDto } from 'nestjs-zod';
import {
  reconciliationContextResponseSchema,
  reconciliationStateResponseSchema,
  updateReconciliationStateSchema,
} from 'pulpe-shared';

// Swagger DTOs derived from the shared Zod schemas (single source of truth).
export class UpdateReconciliationStateDto extends createZodDto(
  updateReconciliationStateSchema,
) {}
export class ReconciliationContextResponseDto extends createZodDto(
  reconciliationContextResponseSchema,
) {}
export class ReconciliationStateResponseDto extends createZodDto(
  reconciliationStateResponseSchema,
) {}
