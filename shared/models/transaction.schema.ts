import { z } from "zod";
import "zod-openapi/extend";

export const expenseTypeSchema = z.enum(["fixed", "variable"]).openapi({
  description: "Type de dépense : fixe ou variable",
  example: "fixed",
});

export const transactionTypeSchema = z.enum(["expense", "income", "saving"]).openapi({
  description: "Type de transaction : dépense, revenu ou épargne",
  example: "expense",
});

export const transactionSchema = z
  .object({
    id: z.string().uuid().openapi({
      description: "Identifiant unique de la transaction",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
    created_at: z.string().datetime().openapi({
      description: "Date de création de la transaction",
      example: "2024-01-01T00:00:00Z",
    }),
    updated_at: z.string().datetime().openapi({
      description: "Date de dernière modification de la transaction",
      example: "2024-01-01T00:00:00Z",
    }),
    user_id: z.string().uuid().nullable().openapi({
      description: "Identifiant de l'utilisateur propriétaire",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
    budget_id: z.string().uuid().openapi({
      description: "Identifiant du budget associé",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
    amount: z.number().positive().openapi({
      description: "Montant de la transaction (toujours positif)",
      example: 100.50,
    }),
    type: transactionTypeSchema,
    expense_type: expenseTypeSchema,
    description: z.string().min(1).max(500).trim().openapi({
      description: "Description de la transaction",
      example: "Achat de courses",
    }),
    is_recurring: z.boolean().default(false).openapi({
      description: "Indique si la transaction est récurrente",
      example: false,
    }),
  })
  .openapi({ description: "Schéma complet d'une transaction" });

export const transactionInsertSchema = transactionSchema
  .omit({
    id: true,
    created_at: true,
    updated_at: true,
  })
  .openapi({ description: "Schéma pour l'insertion d'une nouvelle transaction" });

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

export const transactionCreateRequestSchema = transactionInsertSchema
  .omit({
    user_id: true,
  })
  .openapi({ description: "Schéma pour la création d'une transaction depuis l'API" });

const transactionUpdateBaseSchema = transactionSchema
  .omit({
    id: true,
    created_at: true,
    user_id: true,
    updated_at: true,
  })
  .partial();

export const transactionUpdateRequestDocSchema = transactionUpdateBaseSchema.openapi({
  description: "Schéma pour la mise à jour d'une transaction depuis l'API",
});

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