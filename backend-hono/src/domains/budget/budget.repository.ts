import type { AuthenticatedSupabaseClient } from "../../supabase/client";
import type { Budget, BudgetInsert, BudgetUpdate } from "@pulpe/shared";

export class BudgetRepository {
  constructor(private supabase: AuthenticatedSupabaseClient) {}

  async findAllBudgetsByUserId(): Promise<Budget[] | null> {
    const { data: budgets, error } = await this.supabase
      .from("budgets")
      .select("*")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (error) {
      console.error(
        "REPOSITORY_ERROR: Erreur récupération budgets en base de données:",
        error
      );
      throw new Error("REPOSITORY_ERROR: Failed to retrieve budgets");
    }

    return budgets;
  }

  async createBudget(budgetData: BudgetInsert): Promise<Budget | null> {
    const { data: budget, error } = await this.supabase
      .from("budgets")
      .insert(budgetData)
      .select()
      .single();

    if (error) {
      console.error(
        "REPOSITORY_ERROR: Erreur création budget en base de données:",
        error
      );
      throw new Error("REPOSITORY_ERROR: Failed to create budget");
    }

    return budget;
  }

  async findBudgetById(budgetId: string): Promise<Budget | null> {
    const { data: budget, error } = await this.supabase
      .from("budgets")
      .select("*")
      .eq("id", budgetId)
      .single();

    if (error) {
      console.error(
        "REPOSITORY_ERROR: Erreur récupération budget par ID en base de données:",
        error
      );
      throw new Error("REPOSITORY_ERROR: Failed to retrieve budget by ID");
    }

    return budget;
  }

  async updateBudget(
    budgetId: string,
    updateData: BudgetUpdate
  ): Promise<Budget | null> {
    const filteredUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([, value]) => value !== undefined)
    );

    const { data: budget, error } = await this.supabase
      .from("budgets")
      .update({
        ...filteredUpdateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", budgetId)
      .select()
      .single();

    if (error) {
      console.error(
        "REPOSITORY_ERROR: Erreur modification budget en base de données:",
        error
      );
      throw new Error("REPOSITORY_ERROR: Failed to update budget");
    }

    return budget;
  }

  async deleteBudget(budgetId: string): Promise<void> {
    const { error } = await this.supabase
      .from("budgets")
      .delete()
      .eq("id", budgetId);

    if (error) {
      console.error(
        "REPOSITORY_ERROR: Erreur suppression budget en base de données:",
        error
      );
      throw new Error("REPOSITORY_ERROR: Failed to delete budget");
    }
  }
}
