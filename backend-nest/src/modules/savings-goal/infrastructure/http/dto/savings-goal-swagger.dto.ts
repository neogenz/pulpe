import { createZodDto } from 'nestjs-zod';
import {
  savingsGoalCreateSchema,
  savingsGoalUpdateSchema,
  savingsGoalResponseSchema,
  savingsGoalListResponseSchema,
  savingsGoalDeleteResponseSchema,
  savingsGoalProgressResponseSchema,
  savingsGoalContributionsResponseSchema,
  savingsGoalPlanApplySchema,
  savingsGoalPlanApplyResponseSchema,
  savingsGoalFutureLinesResponseSchema,
  savingsGoalGenerationStopSchema,
  savingsGoalGenerationStopResponseSchema,
  savingsGoalDeletionCommandSchema,
  savingsGoalDeletionImpactResponseSchema,
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
export class SavingsGoalContributionsResponseDto extends createZodDto(
  savingsGoalContributionsResponseSchema,
) {}
export class SavingsGoalPlanApplyDto extends createZodDto(
  savingsGoalPlanApplySchema,
) {}
export class SavingsGoalPlanApplyResponseDto extends createZodDto(
  savingsGoalPlanApplyResponseSchema,
) {}
export class SavingsGoalFutureLinesResponseDto extends createZodDto(
  savingsGoalFutureLinesResponseSchema,
) {}
export class SavingsGoalGenerationStopDto extends createZodDto(
  savingsGoalGenerationStopSchema,
) {}
export class SavingsGoalGenerationStopResponseDto extends createZodDto(
  savingsGoalGenerationStopResponseSchema,
) {}
export class SavingsGoalDeletionCommandDto extends createZodDto(
  savingsGoalDeletionCommandSchema,
) {}
export class SavingsGoalDeletionImpactResponseDto extends createZodDto(
  savingsGoalDeletionImpactResponseSchema,
) {}
