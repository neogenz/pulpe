import { z } from "zod";
import "zod-openapi/extend";
import { transactionSchema } from "./transaction.schema";

export const transactionResponseSchema = z.object({
  success: z.literal(true).openapi({ description: "Indique le succès de l'opération" }),
  transaction: transactionSchema.optional().openapi({ description: "Transaction retournée pour les opérations sur une seule transaction" }),
  transactions: z.array(transactionSchema).optional().openapi({ description: "Liste des transactions pour les opérations de liste" }),
}).openapi({ description: "Réponse de succès pour les opérations sur les transactions" });

export const transactionErrorResponseSchema = z.object({
  success: z.literal(false).openapi({ description: "Indique l'échec de l'opération" }),
  error: z.string().openapi({ description: "Message d'erreur", example: "Erreur lors de la récupération de la transaction" }),
  details: z.array(z.string()).optional().openapi({ description: "Détails supplémentaires sur l'erreur" }),
}).openapi({ description: "Réponse d'erreur pour les opérations sur les transactions" });

export const transactionDeleteResponseSchema = z.object({
  success: z.literal(true).openapi({ description: "Indique le succès de la suppression" }),
  message: z.string().openapi({ description: "Message de confirmation", example: "Transaction supprimée avec succès" }),
}).openapi({ description: "Réponse de succès pour la suppression d'une transaction" });