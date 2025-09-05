import { createZodDto } from 'nestjs-zod';
import {
  budgetCreateSchema,
  budgetUpdateSchema,
  budgetResponseSchema,
  budgetListResponseSchema,
  budgetDeleteResponseSchema,
  budgetDetailsResponseSchema,
  budgetSummaryResponseSchema,
} from '@pulpe/shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class BudgetCreateDto extends createZodDto(budgetCreateSchema) {}
export class BudgetUpdateDto extends createZodDto(budgetUpdateSchema) {}
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
export class BudgetSummaryResponseDto extends createZodDto(
  budgetSummaryResponseSchema,
) {}
