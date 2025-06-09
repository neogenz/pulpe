import { z } from "zod";

export const expenseTypeSchema = z.enum(["fixed", "variable"]);

export const transactionTypeSchema = z.enum(["expense", "income", "saving"]);

export const transactionSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_id: z.string().uuid().nullable(),
  budget_id: z.string().uuid(),
  amount: z.number().positive(),
  type: transactionTypeSchema,
  expense_type: expenseTypeSchema,
  description: z.string().min(1).max(500).trim(),
  is_recurring: z.boolean().default(false),
});

export const transactionInsertSchema = transactionSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const transactionUpdateSchema = transactionSchema
  .omit({
    id: true,
    created_at: true,
    user_id: true,
  })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "Au moins un champ doit être fourni pour la mise à jour"
  );

export const transactionCreateRequestSchema = transactionInsertSchema.omit({
  user_id: true,
});

const transactionUpdateBaseSchema = transactionSchema
  .omit({
    id: true,
    created_at: true,
    user_id: true,
    updated_at: true,
  })
  .partial();

export const transactionUpdateRequestDocSchema = transactionUpdateBaseSchema;

export const transactionUpdateRequestSchema = transactionUpdateBaseSchema
  .refine(
    (data) => Object.keys(data).length > 0,
    "Au moins un champ doit être fourni pour la mise à jour"
  )
  .transform((data) => {
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    return filtered;
  });