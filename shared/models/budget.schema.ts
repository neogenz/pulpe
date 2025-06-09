import { z } from "zod";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;

const MONTH_MIN = 1;
const MONTH_MAX = 12;

export const budgetSchema = z.object({
  id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  user_id: z.string().uuid().nullable(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().min(1).max(500).trim(),
});

export const budgetInsertSchema = budgetSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const budgetCreateRequestSchema = budgetInsertSchema.omit({
  user_id: true,
});

export const budgetCreateFromOnboardingRequestSchema =
  budgetInsertSchema.extend({
    monthlyIncome: z.number().min(0),
    housingCosts: z.number().min(0),
    healthInsurance: z.number().min(0),
    leasingCredit: z.number().min(0),
    phonePlan: z.number().min(0),
    transportCosts: z.number().min(0),
  });

export const budgetCreateFromOnboardingApiRequestSchema = budgetInsertSchema
  .omit({
    user_id: true,
  })
  .extend({
    monthlyIncome: z.number().min(0).optional().default(0),
    housingCosts: z.number().min(0).optional().default(0),
    healthInsurance: z.number().min(0).optional().default(0),
    leasingCredit: z.number().min(0).optional().default(0),
    phonePlan: z.number().min(0).optional().default(0),
    transportCosts: z.number().min(0).optional().default(0),
  });

export const budgetUpdateSchema = budgetSchema
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

const budgetUpdateBaseSchema = budgetSchema
  .omit({
    id: true,
    created_at: true,
    user_id: true,
    updated_at: true,
  })
  .partial();

// Schema for OpenAPI documentation (without refine/transform)
export const budgetUpdateRequestDocSchema = budgetUpdateBaseSchema;

// Schema for validation (with refine/transform)
export const budgetUpdateRequestSchema = budgetUpdateBaseSchema
  .refine(
    (data) => Object.keys(data).length > 0,
    "Au moins un champ doit être fourni pour la mise à jour"
  )
  .transform((data) => {
    // Filtrer les valeurs undefined
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    return filtered;
  });
