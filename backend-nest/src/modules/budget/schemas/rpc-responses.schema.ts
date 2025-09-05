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
