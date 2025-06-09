import { z } from "zod";
import { budgetSchema } from "./budget.schema";

export const budgetResponseSchema = z.object({
  success: z.literal(true),
  budget: budgetSchema.optional(),
  budgets: z.array(budgetSchema).optional(),
});

export const budgetErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.array(z.string()).optional(),
});

export const budgetDeleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});