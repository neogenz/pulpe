import { createZodDto } from 'nestjs-zod';
import {
  budgetTemplateCreateSchema,
  budgetTemplateUpdateSchema,
  budgetTemplateResponseSchema,
  budgetTemplateListResponseSchema,
  budgetTemplateDeleteResponseSchema,
  budgetTemplateCreateResponseSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineUpdateSchema,
  templateLineResponseSchema,
  templateLineListResponseSchema,
  templateLineDeleteResponseSchema,
} from '@pulpe/shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés

// Budget Template DTOs
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
export class BudgetTemplateCreateResponseDto extends createZodDto(
  budgetTemplateCreateResponseSchema,
) {}

// Template Line DTOs
export class TemplateLineCreateDto extends createZodDto(
  templateLineCreateWithoutTemplateIdSchema,
) {}
export class TemplateLineUpdateDto extends createZodDto(
  templateLineUpdateSchema,
) {}
export class TemplateLineResponseDto extends createZodDto(
  templateLineResponseSchema,
) {}
export class TemplateLineListResponseDto extends createZodDto(
  templateLineListResponseSchema,
) {}
export class TemplateLineDeleteResponseDto extends createZodDto(
  templateLineDeleteResponseSchema,
) {}
