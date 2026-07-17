import { createZodDto } from 'nestjs-zod';
import {
  budgetLineSavingsWithdrawalCreateSchema,
  budgetLineSavingsWithdrawalDeleteQuerySchema,
  budgetLineSavingsWithdrawalResponseSchema,
} from 'pulpe-shared';

export class BudgetLineSavingsWithdrawalCreateDto extends createZodDto(
  budgetLineSavingsWithdrawalCreateSchema,
) {}

export class BudgetLineSavingsWithdrawalResponseDto extends createZodDto(
  budgetLineSavingsWithdrawalResponseSchema,
) {}

export class BudgetLineSavingsWithdrawalDeleteQueryDto extends createZodDto(
  budgetLineSavingsWithdrawalDeleteQuerySchema,
) {}
