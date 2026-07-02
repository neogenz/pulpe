import { createZodDto } from 'nestjs-zod';
import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsGoalResponseSchema,
  savingsGoalListResponseSchema,
  savingsGoalDeleteResponseSchema,
  savingsGoalProgressResponseSchema,
} from 'pulpe-shared';

// Swagger DTOs derived from the shared Zod schemas (single source of truth).
export class SavingsGoalCreateDto extends createZodDto(
  savingsGoalCreateSchema,
) {}
export class SavingsGoalUpdateDto extends createZodDto(
  savingsGoalUpdateSchema,
) {}
export class SavingsGoalResponseDto extends createZodDto(
  savingsGoalResponseSchema,
) {}
export class SavingsGoalListResponseDto extends createZodDto(
  savingsGoalListResponseSchema,
) {}
export class SavingsGoalDeleteResponseDto extends createZodDto(
  savingsGoalDeleteResponseSchema,
) {}
export class SavingsGoalProgressResponseDto extends createZodDto(
  savingsGoalProgressResponseSchema,
) {}
