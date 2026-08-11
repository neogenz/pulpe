import {
  type BudgetTemplate,
  budgetTemplateListResponseSchema,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

export function fetchTemplates(): Promise<BudgetTemplate[]> {
  return api
    .get(ENDPOINTS.templates, budgetTemplateListResponseSchema)
    .then((response) => response.data);
}
