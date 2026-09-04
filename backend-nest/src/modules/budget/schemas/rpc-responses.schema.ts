import { z } from 'zod';

/**
 * Schema for the create_budget_from_template RPC function response
 * Validates the structure returned by the PostgreSQL function
 */
export const createBudgetFromTemplateResponseSchema = z.object({
  budget: z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid().nullable(),
    template_id: z.string().uuid(),
    month: z.number().int().min(1).max(12),
    year: z.number().int(),
    description: z.string(),
    ending_balance: z.number().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
  budget_lines_created: z.number().int().nonnegative(),
  template_name: z.string().min(1),
});

export const generateBudgetsFromTemplateResponseSchema = z.strictObject({
  created_budget_ids: z.array(z.string().uuid()),
  skipped_months: z.array(
    z.strictObject({
      month: z.number().int().min(1).max(12),
      year: z.number().int().min(2020),
    }),
  ),
});

const generatedBudgetIdsSchema = z.object({
  created_budget_ids: z.array(z.string().uuid()),
});

/**
 * Schema for the get_budget_with_rollover RPC function response
 * Validates the structure returned by the PostgreSQL function
 */
export const getBudgetWithRolloverResponseSchema = z.object({
  ending_balance: z.number(),
  rollover: z.number(),
  available_to_spend: z.number(),
  previous_budget_id: z.string().uuid().nullable(),
});

/**
 * Type inference for create_budget_from_template response
 */
export type CreateBudgetFromTemplateResponse = z.infer<
  typeof createBudgetFromTemplateResponseSchema
>;

export type GenerateBudgetsFromTemplateResponse = z.infer<
  typeof generateBudgetsFromTemplateResponseSchema
>;

/**
 * Type inference for get_budget_with_rollover response
 */
export type GetBudgetWithRolloverResponse = z.infer<
  typeof getBudgetWithRolloverResponseSchema
>;

/**
 * Validates and parses the create_budget_from_template RPC response
 * @param data - Raw response from RPC function
 * @returns Validated and typed response data
 * @throws ZodError if validation fails
 */
export function validateCreateBudgetResponse(
  data: unknown,
): CreateBudgetFromTemplateResponse {
  return createBudgetFromTemplateResponseSchema.parse(data);
}

export function validateGenerateBudgetsResponse(
  data: unknown,
): GenerateBudgetsFromTemplateResponse {
  return generateBudgetsFromTemplateResponseSchema.parse(data);
}

export function extractGeneratedBudgetIds(data: unknown): string[] {
  const result = generatedBudgetIdsSchema.safeParse(data);
  return result.success ? result.data.created_budget_ids : [];
}

/**
 * Validates and parses the get_budget_with_rollover RPC response
 * @param data - Raw response from RPC function
 * @returns Validated and typed response data
 * @throws ZodError if validation fails
 */
export function validateBudgetWithRolloverResponse(
  data: unknown,
): GetBudgetWithRolloverResponse {
  return getBudgetWithRolloverResponseSchema.parse(data);
}
