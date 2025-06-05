import { z } from "zod";
import "zod-openapi/extend";
import { budgetSchema } from "./budget.schema";

export const budgetResponseSchema = z.object({
  success: z.literal(true).openapi({ description: "Indique le succès de l'opération" }),
  budget: budgetSchema.optional().openapi({ description: "Budget retourné pour les opérations sur un seul budget" }),
  budgets: z.array(budgetSchema).optional().openapi({ description: "Liste des budgets pour les opérations de liste" }),
}).openapi({ description: "Réponse de succès pour les opérations sur les budgets" });

export const budgetErrorResponseSchema = z.object({
  success: z.literal(false).openapi({ description: "Indique l'échec de l'opération" }),
  error: z.string().openapi({ description: "Message d'erreur", example: "Erreur lors de la récupération du budget" }),
  details: z.array(z.string()).optional().openapi({ description: "Détails supplémentaires sur l'erreur" }),
}).openapi({ description: "Réponse d'erreur pour les opérations sur les budgets" });

export const budgetDeleteResponseSchema = z.object({
  success: z.literal(true).openapi({ description: "Indique le succès de la suppression" }),
  message: z.string().openapi({ description: "Message de confirmation", example: "Budget supprimé avec succès" }),
}).openapi({ description: "Réponse de succès pour la suppression d'un budget" });