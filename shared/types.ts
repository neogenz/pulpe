import type { z } from "zod";
import type {
  budgetSchema,
  budgetCreateSchema,
  budgetCreateFromOnboardingSchema,
  budgetUpdateSchema,
  transactionSchema,
  transactionCreateSchema,
  transactionUpdateSchema,
  expenseTypeSchema,
  transactionTypeSchema,
  errorResponseSchema,
  deleteResponseSchema,
  budgetResponseSchema,
  budgetListResponseSchema,
  budgetDeleteResponseSchema,
  transactionResponseSchema,
  transactionListResponseSchema,
  transactionDeleteResponseSchema,
} from "./schemas";

// Budget types
export type Budget = z.infer<typeof budgetSchema>;
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;
export type BudgetCreateFromOnboarding = z.infer<typeof budgetCreateFromOnboardingSchema>;
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;

// Transaction types
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;
export type ExpenseType = z.infer<typeof expenseTypeSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;

// Response types
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
export type DeleteResponse = z.infer<typeof deleteResponseSchema>;

// Strict response types with Zod validation
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;
export type BudgetListResponse = z.infer<typeof budgetListResponseSchema>;
export type BudgetDeleteResponse = z.infer<typeof budgetDeleteResponseSchema>;

// Operation-specific transaction response types for type safety
export type TransactionCreateResponse = z.infer<typeof transactionResponseSchema>;
export type TransactionUpdateResponse = z.infer<typeof transactionResponseSchema>;
export type TransactionFindOneResponse = z.infer<typeof transactionResponseSchema>;
export type TransactionListResponse = z.infer<typeof transactionListResponseSchema>;
export type TransactionDeleteResponse = z.infer<typeof transactionDeleteResponseSchema>;

// Legacy generic type - prefer operation-specific types above
export type TransactionResponse = {
  success: true;
  data?: Transaction | Transaction[];
};