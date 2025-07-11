import { createZodDto } from 'nestjs-zod';
import {
  budgetTemplateCreateSchema,
  budgetTemplateUpdateSchema,
  budgetTemplateResponseSchema,
  budgetTemplateListResponseSchema,
  budgetTemplateDeleteResponseSchema,
  templateLineListResponseSchema,
} from '@pulpe/shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés
export class BudgetTemplateCreateDto extends createZodDto(
  budgetTemplateCreateSchema,
) {}
export class BudgetTemplateUpdateDto extends createZodDto(
  budgetTemplateUpdateSchema,
) {}
export class BudgetTemplateResponseDto extends createZodDto(
  budgetTemplateResponseSchema,
) {}
export class BudgetTemplateListResponseDto extends createZodDto(
  budgetTemplateListResponseSchema,
) {}
export class BudgetTemplateDeleteResponseDto extends createZodDto(
  budgetTemplateDeleteResponseSchema,
) {}
export class TemplateLineListResponseDto extends createZodDto(
  templateLineListResponseSchema,
) {}
