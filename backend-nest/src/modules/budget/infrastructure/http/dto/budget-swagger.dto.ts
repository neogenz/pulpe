import { createZodDto } from 'nestjs-zod';
import {
  budgetCreateSchema,
  budgetUpdateSchema,
  budgetGenerateSchema,
  budgetGenerateResponseSchema,
  budgetResponseSchema,
  budgetListResponseSchema,
  budgetDeleteResponseSchema,
  budgetDetailsResponseSchema,
  listBudgetsQuerySchema,
  budgetSparseListResponseSchema,
} from 'pulpe-shared';

export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}
export class BudgetUpdateDto extends createZodDto(budgetUpdateSchema) {}
export class BudgetGenerateDto extends createZodDto(budgetGenerateSchema) {}
export class BudgetGenerateResponseDto extends createZodDto(
  budgetGenerateResponseSchema,
) {}
export class BudgetResponseDto extends createZodDto(budgetResponseSchema) {}
export class BudgetListResponseDto extends createZodDto(
  budgetListResponseSchema,
) {}
export class BudgetDeleteResponseDto extends createZodDto(
  budgetDeleteResponseSchema,
) {}
export class BudgetDetailsResponseDto extends createZodDto(
  budgetDetailsResponseSchema,
) {}
export class ListBudgetsQueryDto extends createZodDto(listBudgetsQuerySchema) {}
export class BudgetSparseListResponseDto extends createZodDto(
  budgetSparseListResponseSchema,
) {}
