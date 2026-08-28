import {
  type BudgetGenerate,
  budgetGenerateResponseSchema,
  budgetGenerateSchema,
  type BudgetTemplateCreateFromOnboarding,
  budgetTemplateCreateFromOnboardingSchema,
  budgetTemplateCreateResponseSchema,
  getBudgetPeriodForDate,
} from "pulpe-shared";

import { api } from "@/core/api/api";
import { ENDPOINTS } from "@/core/api/endpoints";

/**
 * The current period plus the twelve the projection shows, matching
 * `INITIAL_BUDGET_MONTHS` in the webapp's `ProfileSetupService`. iOS creates a
 * single month instead; the webapp is the reference here because a budget list
 * with one entry has nothing to project.
 */
const INITIAL_BUDGET_MONTHS = 13;

/** Returns the id of the template the budgets will be generated from. */
export async function createTemplateFromOnboarding(
  payload: BudgetTemplateCreateFromOnboarding,
): Promise<string> {
  const response = await api.post(
    ENDPOINTS.templateFromOnboarding,
    payload,
    budgetTemplateCreateResponseSchema,
    budgetTemplateCreateFromOnboardingSchema,
  );
  return response.data.template.id;
}

/**
 * The pay day is not asked during onboarding, so the first budget covers the
 * calendar month — `getBudgetPeriodForDate` returns exactly that without one.
 */
export async function generateInitialBudgets(
  templateId: string,
  now: Date,
): Promise<void> {
  const { month, year } = getBudgetPeriodForDate(now);
  const payload: BudgetGenerate = {
    templateId,
    startMonth: month,
    startYear: year,
    count: INITIAL_BUDGET_MONTHS,
  };

  await api.post(
    ENDPOINTS.budgetsGenerate,
    payload,
    budgetGenerateResponseSchema,
    budgetGenerateSchema,
  );
}

export function deleteTemplate(templateId: string): Promise<void> {
  return api.deleteVoid(ENDPOINTS.template(templateId));
}
