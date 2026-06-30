import { createZodDto } from 'nestjs-zod';
import {
  budgetLineCreateSchema,
  budgetLineUpdateSchema,
  budgetLineResponseSchema,
  budgetLineListResponseSchema,
  budgetLineDeleteResponseSchema,
  budgetLinePostponeResponseSchema,
  transactionListResponseSchema,
} from 'pulpe-shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class BudgetLineCreateDto extends createZodDto(budgetLineCreateSchema) {}
export class BudgetLineUpdateDto extends createZodDto(budgetLineUpdateSchema) {}
export class BudgetLineResponseDto extends createZodDto(
  budgetLineResponseSchema,
) {}
export class BudgetLineListResponseDto extends createZodDto(
  budgetLineListResponseSchema,
) {}
export class BudgetLineDeleteResponseDto extends createZodDto(
  budgetLineDeleteResponseSchema,
) {}
export class BudgetLinePostponeResponseDto extends createZodDto(
  budgetLinePostponeResponseSchema,
) {}
export class TransactionListResponseDto extends createZodDto(
  transactionListResponseSchema,
) {}
