import { z } from "zod";
import "zod-openapi/extend";

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;

const MONTH_MIN = 1;
const MONTH_MAX = 12;

export const budgetSchema = z.object({
  id: z.string().uuid().openapi({ description: "Identifiant unique du budget", example: "123e4567-e89b-12d3-a456-426614174000" }),
  created_at: z.string().datetime().openapi({ description: "Date de création du budget", example: "2024-01-01T00:00:00Z" }),
  updated_at: z.string().datetime().openapi({ description: "Date de dernière modification du budget", example: "2024-01-01T00:00:00Z" }),
  user_id: z.string().uuid().nullable().openapi({ description: "Identifiant de l'utilisateur propriétaire", example: "123e4567-e89b-12d3-a456-426614174000" }),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX).openapi({ description: "Mois du budget (1-12)", example: 1 }),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR).openapi({ description: `Année du budget (${MIN_YEAR}-${MAX_YEAR})`, example: CURRENT_YEAR }),
  description: z.string().min(1).max(500).trim().openapi({ description: "Description du budget", example: "Budget mensuel janvier 2024" }),
}).openapi({ description: "Schéma complet d'un budget" });

export const budgetInsertSchema = budgetSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
}).openapi({ description: "Schéma pour l'insertion d'un nouveau budget" });

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

export const budgetCreateRequestSchema = budgetInsertSchema.omit({
  user_id: true,
}).openapi({ description: "Schéma pour la création d'un budget depuis l'API" });

const budgetUpdateBaseSchema = budgetSchema
  .omit({
    id: true,
    created_at: true,
    user_id: true,
    updated_at: true,
  })
  .partial();

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
  })
  .openapi({ description: "Schéma pour la mise à jour d'un budget depuis l'API" });
