import { createZodDto } from 'nestjs-zod';
import {
  budgetTemplateCreateSchema,
  budgetTemplateCreateFromOnboardingSchema,
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
  templateLinesBulkUpdateSchema,
  templateLinesBulkUpdateResponseSchema,
  templateLinesBulkOperationsSchema,
  templateLinesBulkOperationsResponseSchema,
  templateUsageResponseSchema,
} from 'pulpe-shared';

// DTOs pour la documentation Swagger basés sur les schémas Zod partagés

// Budget Template DTOs
export class BudgetTemplateCreateDto extends createZodDto(
  budgetTemplateCreateSchema,
) {}
export class BudgetTemplateCreateFromOnboardingDto extends createZodDto(
  budgetTemplateCreateFromOnboardingSchema,
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

// Template Line Bulk Update DTOs
export class TemplateLinesBulkUpdateDto extends createZodDto(
  templateLinesBulkUpdateSchema,
) {}
export class TemplateLinesBulkUpdateResponseDto extends createZodDto(
  templateLinesBulkUpdateResponseSchema,
) {}

// Template Line Bulk Operations DTOs (Create/Update/Delete)
export class TemplateLinesBulkOperationsDto extends createZodDto(
  templateLinesBulkOperationsSchema,
) {}
export class TemplateLinesBulkOperationsResponseDto extends createZodDto(
  templateLinesBulkOperationsResponseSchema,
) {}

// Template Usage DTO
export class TemplateUsageResponseDto extends createZodDto(
  templateUsageResponseSchema,
) {}
