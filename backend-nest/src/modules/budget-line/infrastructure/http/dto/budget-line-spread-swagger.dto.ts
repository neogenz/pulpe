import { createZodDto } from 'nestjs-zod';
import {
  budgetLineSpreadCreateSchema,
  budgetLineSpreadResponseSchema,
  spreadOccurrencesResponseSchema,
} from 'pulpe-shared';

export class BudgetLineSpreadCreateDto extends createZodDto(
  budgetLineSpreadCreateSchema,
) {}

export class BudgetLineSpreadResponseDto extends createZodDto(
  budgetLineSpreadResponseSchema,
) {}

export class SpreadOccurrencesResponseDto extends createZodDto(
  spreadOccurrencesResponseSchema,
) {}
