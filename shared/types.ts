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

export type BudgetResponse = {
  success: true;
  data?: Budget | Budget[];
};

export type TransactionResponse = {
  success: true;
  data?: Transaction | Transaction[];
};