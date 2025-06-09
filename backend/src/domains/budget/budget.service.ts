import type { Budget, BudgetUpdate } from "@pulpe/shared";
import {
  BudgetCreateFromOnboardingRequest,
  type TransactionInsert,
  type TransactionType,
  type ExpenseType,
} from "@pulpe/shared";
import { format, parseISO, isValid } from "date-fns";
import { fr } from "date-fns/locale";
import type { AuthenticatedSupabaseClient } from "../../supabase/client";
import { BudgetRepository } from "./budget.repository";

interface CreateBudgetWithTransactionsResult {
  budget: Budget;
  transactions_created: number;
}

export class BudgetService {
  private budgetRepository: BudgetRepository;
  private supabase: AuthenticatedSupabaseClient;

  constructor(supabase: AuthenticatedSupabaseClient) {
    this.budgetRepository = new BudgetRepository(supabase);
    this.supabase = supabase;
  }

  async getAllBudgets(): Promise<Budget[]> {
    try {
      const budgets = await this.budgetRepository.findAllBudgetsByUserId();
      return budgets || [];
    } catch (error) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la récupération des budgets:",
        error
      );
      throw new Error("SERVICE_ERROR: Failed to fetch budgets");
    }
  }

  async createBasicBudget(budgetData: {
    user_id: string;
    month: number;
    year: number;
    description: string;
  }): Promise<Budget> {
    try {
      if (!budgetData.month || !budgetData.year) {
        throw new Error("SERVICE_ERROR: Month and year are required");
      }

      if (!budgetData.user_id) {
        throw new Error("SERVICE_ERROR: User ID is required");
      }

      const { data: budget, error: budgetError } = await this.supabase
        .from("budgets")
        .insert(budgetData)
        .select()
        .single();

      if (budgetError || !budget) {
        console.error(
          "SERVICE_ERROR: Erreur lors de la création du budget:",
          budgetError
        );
        throw new Error("SERVICE_ERROR: Failed to create budget");
      }

      return budget;
    } catch (error) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la création du budget:",
        error
      );

      if (
        error instanceof Error &&
        error.message.startsWith("SERVICE_ERROR:")
      ) {
        throw error;
      }

      throw new Error("SERVICE_ERROR: Failed to create budget");
    }
  }

  async createBudget(
    budgetData: BudgetCreateFromOnboardingRequest
  ): Promise<Budget> {
    const {
      monthlyIncome,
      housingCosts,
      healthInsurance,
      leasingCredit,
      phonePlan,
      transportCosts,
      month,
      year,
      user_id,
      description,
    } = budgetData;

    try {
      // Validate required fields
      if (!month || !year) {
        throw new Error("SERVICE_ERROR: Month and year are required");
      }

      if (!user_id) {
        throw new Error("SERVICE_ERROR: User ID is required");
      }

      const monthNumber = this.extractMonthNumber(month);
      const budgetDescription = description || "Budget créé depuis onboarding";

      // Use the BudgetRepository to create budget and transactions atomically
      const result = await this.createBudgetWithTransactionsAtomic({
        user_id,
        month: monthNumber,
        year,
        description: budgetDescription,
        monthlyIncome: monthlyIncome || 0,
        housingCosts: housingCosts || 0,
        healthInsurance: healthInsurance || 0,
        leasingCredit: leasingCredit || 0,
        phonePlan: phonePlan || 0,
        transportCosts: transportCosts || 0,
      });

      console.log(
        `Budget créé avec ${result.transactions_created} transactions associées`
      );

      return result.budget;
    } catch (error) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la création du budget et des transactions:",
        error
      );

      if (
        error instanceof Error &&
        error.message.startsWith("SERVICE_ERROR:")
      ) {
        throw error;
      }

      throw new Error(
        "SERVICE_ERROR: Failed to create budget and associated transactions"
      );
    }
  }

  private async createBudgetWithTransactionsAtomic(params: {
    user_id: string;
    month: number;
    year: number;
    description: string;
    monthlyIncome: number;
    housingCosts: number;
    healthInsurance: number;
    leasingCredit: number;
    phonePlan: number;
    transportCosts: number;
  }): Promise<CreateBudgetWithTransactionsResult> {
    // Create budget first
    const budgetInsert = {
      user_id: params.user_id,
      month: params.month,
      year: params.year,
      description: params.description,
    };

    const { data: budget, error: budgetError } = await this.supabase
      .from("budgets")
      .insert(budgetInsert)
      .select()
      .single();

    if (budgetError || !budget) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la création du budget:",
        budgetError
      );
      throw new Error("SERVICE_ERROR: Failed to create budget");
    }

    // Create transactions
    const transactions: TransactionInsert[] = [];
    let transactionCount = 0;

    if (params.monthlyIncome > 0) {
      transactions.push({
        user_id: params.user_id,
        budget_id: budget.id,
        amount: params.monthlyIncome,
        type: "income",
        expense_type: "fixed",
        description: "Revenu mensuel",
        is_recurring: true,
      });
      transactionCount++;
    }

    if (params.housingCosts > 0) {
      transactions.push({
        user_id: params.user_id,
        budget_id: budget.id,
        amount: params.housingCosts,
        type: "expense",
        expense_type: "fixed",
        description: "Loyer",
        is_recurring: true,
      });
      transactionCount++;
    }

    if (params.healthInsurance > 0) {
      transactions.push({
        user_id: params.user_id,
        budget_id: budget.id,
        amount: params.healthInsurance,
        type: "expense",
        expense_type: "fixed",
        description: "Assurance santé",
        is_recurring: true,
      });
      transactionCount++;
    }

    if (params.leasingCredit > 0) {
      transactions.push({
        user_id: params.user_id,
        budget_id: budget.id,
        amount: params.leasingCredit,
        type: "expense",
        expense_type: "fixed",
        description: "Crédit leasing",
        is_recurring: true,
      });
      transactionCount++;
    }

    if (params.phonePlan > 0) {
      transactions.push({
        user_id: params.user_id,
        budget_id: budget.id,
        amount: params.phonePlan,
        type: "expense",
        expense_type: "fixed",
        description: "Forfait téléphonique",
        is_recurring: true,
      });
      transactionCount++;
    }

    if (params.transportCosts > 0) {
      transactions.push({
        user_id: params.user_id,
        budget_id: budget.id,
        amount: params.transportCosts,
        type: "expense",
        expense_type: "fixed",
        description: "Frais de transport",
        is_recurring: true,
      });
      transactionCount++;
    }

    // Insert transactions if any
    if (transactions.length > 0) {
      const { error: transactionsError } = await this.supabase
        .from("transactions")
        .insert(transactions);

      if (transactionsError) {
        console.error(
          "SERVICE_ERROR: Erreur lors de la création des transactions:",
          transactionsError
        );
        // Rollback budget creation
        await this.supabase.from("budgets").delete().eq("id", budget.id);
        throw new Error(
          "SERVICE_ERROR: Failed to create transactions, budget rolled back"
        );
      }
    }

    return {
      budget,
      transactions_created: transactionCount,
    };
  }

  private extractMonthNumber(month: string | number | Date): number {
    if (typeof month === "number") {
      if (month < 1 || month > 12) {
        throw new Error("SERVICE_ERROR: Invalid month number");
      }
      return month;
    }

    if (typeof month === "string") {
      if (month.includes("-")) {
        const date = parseISO(month);
        if (!isValid(date)) {
          throw new Error("SERVICE_ERROR: Invalid date string");
        }
        return date.getMonth() + 1; // getMonth() returns 0-11
      } else {
        const monthNumber = parseInt(month, 10);
        if (monthNumber < 1 || monthNumber > 12) {
          throw new Error("SERVICE_ERROR: Invalid month number");
        }
        return monthNumber;
      }
    }

    if (month instanceof Date) {
      if (!isValid(month)) {
        throw new Error("SERVICE_ERROR: Invalid date");
      }
      return month.getMonth() + 1;
    }

    throw new Error("SERVICE_ERROR: Invalid month format");
  }

  private validateAndFormatMonth(month: string, year: number): string {
    let dateToValidate: Date;

    // Try to parse ISO string or create date from year/month
    if (month.includes("-")) {
      dateToValidate = parseISO(month);
    } else {
      // Assume month is a number string (1-12)
      const monthNumber = parseInt(month, 10);
      if (monthNumber < 1 || monthNumber > 12) {
        throw new Error("SERVICE_ERROR: Invalid month number");
      }
      dateToValidate = new Date(year, monthNumber - 1, 1);
    }

    if (!isValid(dateToValidate)) {
      throw new Error("SERVICE_ERROR: Invalid date provided");
    }

    // Format to YYYY-MM-DD for first day of month
    return format(dateToValidate, "yyyy-MM-01");
  }

  async getBudgetById(budgetId: string): Promise<Budget> {
    try {
      const budget = await this.budgetRepository.findBudgetById(budgetId);
      if (!budget) {
        throw new Error("SERVICE_ERROR: Budget not found");
      }
      return budget;
    } catch (error) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la récupération du budget par ID:",
        error
      );
      throw new Error("SERVICE_ERROR: Failed to get budget by ID");
    }
  }

  async updateBudget(
    budgetId: string,
    updateData: BudgetUpdate
  ): Promise<Budget> {
    try {
      const budget = await this.budgetRepository.updateBudget(
        budgetId,
        updateData
      );
      if (!budget) {
        throw new Error("SERVICE_ERROR: Budget update failed");
      }
      return budget;
    } catch (error) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la mise à jour du budget:",
        error
      );
      throw new Error("SERVICE_ERROR: Failed to update budget");
    }
  }

  async deleteBudget(budgetId: string): Promise<void> {
    try {
      await this.budgetRepository.deleteBudget(budgetId);
    } catch (error) {
      console.error(
        "SERVICE_ERROR: Erreur lors de la suppression du budget:",
        error
      );
      throw new Error("SERVICE_ERROR: Failed to delete budget");
    }
  }
}
