import { z } from "zod";
import { transactionSchema } from "./transaction.schema";

export const transactionResponseSchema = z.object({
  success: z.literal(true),
  transaction: transactionSchema.optional(),
  transactions: z.array(transactionSchema).optional(),
});

export const transactionErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.array(z.string()).optional(),
});

export const transactionDeleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});