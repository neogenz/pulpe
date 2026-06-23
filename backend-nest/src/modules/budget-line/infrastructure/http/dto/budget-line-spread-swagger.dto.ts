import { createZodDto } from 'nestjs-zod';
import {
  budgetLineSpreadCreateSchema,
  budgetLineSpreadFromLineCreateSchema,
  budgetLineSpreadResponseSchema,
  spreadOccurrencesResponseSchema,
} from 'pulpe-shared';

export class BudgetLineSpreadCreateDto extends createZodDto(
  budgetLineSpreadCreateSchema,
) {}

export class BudgetLineSpreadFromLineCreateDto extends createZodDto(
  budgetLineSpreadFromLineCreateSchema,
) {}

export class BudgetLineSpreadResponseDto extends createZodDto(
  budgetLineSpreadResponseSchema,
) {}

export class SpreadOccurrencesResponseDto extends createZodDto(
  spreadOccurrencesResponseSchema,
) {}
