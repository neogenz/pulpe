import { createZodDto } from 'nestjs-zod';
import {
  budgetTemplateSchema,
  budgetTemplateLineSchema,
  createBudgetTemplateSchema,
  updateBudgetTemplateSchema,
  createBudgetTemplateLineSchema,
  updateBudgetTemplateLineSchema,
} from '@pulpe/shared';

export class BudgetTemplateSwaggerDto extends createZodDto(
  budgetTemplateSchema,
) {}
export class BudgetTemplateLineSwaggerDto extends createZodDto(
  budgetTemplateLineSchema,
) {}
export class CreateBudgetTemplateSwaggerDto extends createZodDto(
  createBudgetTemplateSchema,
) {}
export class UpdateBudgetTemplateSwaggerDto extends createZodDto(
  updateBudgetTemplateSchema,
) {}
export class CreateBudgetTemplateLineSwaggerDto extends createZodDto(
  createBudgetTemplateLineSchema,
) {}
export class UpdateBudgetTemplateLineSwaggerDto extends createZodDto(
  updateBudgetTemplateLineSchema,
) {}
