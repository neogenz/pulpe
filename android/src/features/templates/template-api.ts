import {
  type BudgetTemplate,
  type BudgetTemplateCreate,
  budgetTemplateCreateSchema,
  budgetTemplateListResponseSchema,
  budgetTemplateResponseSchema,
  type BudgetTemplateUpdate,
  budgetTemplateUpdateSchema,
  type TemplateLine,
  templateLineCreateSchema,
  templateLineCreateWithoutTemplateIdSchema,
  templateLineListResponseSchema,
  templateLineResponseSchema,
  type TemplateLinesBulkOperations,
  templateLinesBulkOperationsResponseSchema,
  type TemplateLinesBulkOperationsResponse,
  templateLinesBulkOperationsSchema,
  type TemplateLineUpdate,
  templateLineUpdateSchema,
  type TemplateUsageResponse,
  templateUsageResponseSchema,
} from "pulpe-shared";

import type { z } from "zod";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/** `pulpe-shared` exports the schema but not its inferred type. */
export type TemplateLineCreate = z.infer<typeof templateLineCreateSchema>;
type TemplateLineCreateBody = z.infer<
  typeof templateLineCreateWithoutTemplateIdSchema
>;

export function fetchTemplates(): Promise<BudgetTemplate[]> {
  return api
    .get(ENDPOINTS.templates, budgetTemplateListResponseSchema)
    .then((response) => response.data);
}

export function fetchTemplate(templateId: string): Promise<BudgetTemplate> {
  return api
    .get(ENDPOINTS.template(templateId), budgetTemplateResponseSchema)
    .then((response) => response.data);
}

export function fetchTemplateLines(
  templateId: string,
): Promise<TemplateLine[]> {
  return api
    .get(ENDPOINTS.templateLines(templateId), templateLineListResponseSchema)
    .then((response) => response.data);
}

/**
 * Which budgets were generated from this model. Read before any edit: it is
 * what decides whether the user is asked to propagate.
 */
export function fetchTemplateUsage(
  templateId: string,
): Promise<TemplateUsageResponse["data"]> {
  return api
    .get(ENDPOINTS.templateUsage(templateId), templateUsageResponseSchema)
    .then((response) => response.data);
}

export function createTemplate(
  payload: BudgetTemplateCreate,
): Promise<BudgetTemplate> {
  return api
    .post<
      { data: BudgetTemplate },
      BudgetTemplateCreate
    >(ENDPOINTS.templates, payload, budgetTemplateResponseSchema, budgetTemplateCreateSchema)
    .then((response) => response.data);
}

export function updateTemplate(input: {
  templateId: string;
  changes: BudgetTemplateUpdate;
}): Promise<BudgetTemplate> {
  return api
    .patch<
      { data: BudgetTemplate },
      BudgetTemplateUpdate
    >(ENDPOINTS.template(input.templateId), input.changes, budgetTemplateResponseSchema, budgetTemplateUpdateSchema)
    .then((response) => response.data);
}

export function deleteTemplate(templateId: string): Promise<void> {
  return api.deleteVoid(ENDPOINTS.template(templateId));
}

export function createTemplateLine(
  payload: TemplateLineCreate,
): Promise<TemplateLine> {
  const { templateId, ...body } = payload;

  return api
    .post<
      { data: TemplateLine },
      TemplateLineCreateBody
    >(ENDPOINTS.templateLines(templateId), body, templateLineResponseSchema, templateLineCreateWithoutTemplateIdSchema)
    .then((response) => response.data);
}

export function updateTemplateLine(input: {
  templateId: string;
  lineId: string;
  changes: TemplateLineUpdate;
}): Promise<TemplateLine> {
  return api
    .patch<
      { data: TemplateLine },
      TemplateLineUpdate
    >(ENDPOINTS.templateLine(input.templateId, input.lineId), input.changes, templateLineResponseSchema, templateLineUpdateSchema)
    .then((response) => response.data);
}

export function deleteTemplateLine(input: {
  templateId: string;
  lineId: string;
}): Promise<void> {
  return api.deleteVoid(ENDPOINTS.templateLine(input.templateId, input.lineId));
}

/**
 * The only path that reaches the budgets already generated from the model.
 * Everything else stops at the model itself.
 */
export function bulkTemplateLines(input: {
  templateId: string;
  operations: TemplateLinesBulkOperations;
}): Promise<TemplateLinesBulkOperationsResponse["data"]> {
  return api
    .post<
      TemplateLinesBulkOperationsResponse,
      TemplateLinesBulkOperations
    >(ENDPOINTS.templateLinesBulk(input.templateId), input.operations, templateLinesBulkOperationsResponseSchema, templateLinesBulkOperationsSchema)
    .then((response) => response.data);
}
