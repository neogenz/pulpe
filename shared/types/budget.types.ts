import type { z } from "zod";
import type {
  budgetSchema,
  budgetInsertSchema,
  budgetUpdateSchema,
  budgetCreateRequestSchema,
  budgetUpdateRequestSchema,
} from "../models/budget.schema";

export type Budget = z.infer<typeof budgetSchema>;
export type BudgetInsert = z.infer<typeof budgetInsertSchema>;
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;
export type BudgetCreateRequest = z.infer<typeof budgetCreateRequestSchema>;
export type BudgetUpdateRequest = z.infer<typeof budgetUpdateRequestSchema>;

export interface BudgetResponse {
  readonly success: boolean;
  readonly budget?: Budget;
  readonly budgets?: Budget[];
}

export interface BudgetErrorResponse {
  readonly success: false;
  readonly error: string;
  readonly details?: string[];
}
