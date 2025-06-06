import type { z } from "zod";
import type {
  transactionSchema,
  transactionInsertSchema,
  transactionUpdateSchema,
  transactionCreateRequestSchema,
  transactionUpdateRequestSchema,
  expenseTypeSchema,
  transactionTypeSchema,
} from "../models/transaction.schema";
import type {
  transactionResponseSchema,
  transactionErrorResponseSchema,
} from "../models/transaction-response.schema";

export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionInsert = z.infer<typeof transactionInsertSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type TransactionCreateRequest = z.infer<typeof transactionCreateRequestSchema>;
export type TransactionUpdateRequest = z.infer<typeof transactionUpdateRequestSchema>;
export type ExpenseType = z.infer<typeof expenseTypeSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export type TransactionResponse = z.infer<typeof transactionResponseSchema>;
export type TransactionErrorResponse = z.infer<typeof transactionErrorResponseSchema>;