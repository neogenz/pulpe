import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import type { AuthenticatedSupabaseClient } from '../supabase/supabase.service';
import {
  exportDataSchema,
  type ExportData,
} from './schemas/export-data.schema';
import { ImportMode, type ImportResultDto } from './dto/import-data.dto';
import type { Database } from '../../types/database.types';

@Injectable()
export class DataTransferService {
  #logger = new Logger(DataTransferService.name);

  /**
   * Export all user data to a JSON format
   */
  // eslint-disable-next-line max-lines-per-function, complexity
  async exportUserData(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<ExportData> {
    try {
      // Step 1: Fetch user's templates, budgets and savings goals
      const [templatesResult, monthlyBudgetsResult, savingsGoalsResult] =
        await Promise.all([
          supabase
            .from('template')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),

          supabase
            .from('monthly_budget')
            .select('*')
            .eq('user_id', userId)
            .order('year', { ascending: true })
            .order('month', { ascending: true }),

          supabase
            .from('savings_goal')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true }),
        ]);

      // Check for errors
      if (templatesResult.error) {
        this.#logger.error('Error fetching templates', templatesResult.error);
        throw templatesResult.error;
      }
      if (monthlyBudgetsResult.error) {
        this.#logger.error(
          'Error fetching monthly budgets',
          monthlyBudgetsResult.error,
        );
        throw monthlyBudgetsResult.error;
      }
      if (savingsGoalsResult.error) {
        this.#logger.error(
          'Error fetching savings goals',
          savingsGoalsResult.error,
        );
        throw savingsGoalsResult.error;
      }

      const templates = templatesResult.data || [];
      const monthlyBudgets = monthlyBudgetsResult.data || [];
      const savingsGoals = savingsGoalsResult.data || [];

      // Get template and budget IDs
      const templateIds = templates.map((t) => t.id);
      const budgetIds = monthlyBudgets.map((b) => b.id);

      // Step 2: Fetch related data using collected IDs
      let templateLines: Database['public']['Tables']['template_line']['Row'][] =
        [];
      let budgetLines: Database['public']['Tables']['budget_line']['Row'][] =
        [];
      let transactions: Database['public']['Tables']['transaction']['Row'][] =
        [];

      // Fetch template lines if we have templates
      if (templateIds.length > 0) {
        const templateLinesResult = await supabase
          .from('template_line')
          .select('*')
          .in('template_id', templateIds)
          .order('created_at', { ascending: true });

        if (templateLinesResult.error) {
          this.#logger.error(
            'Error fetching template lines',
            templateLinesResult.error,
          );
          throw templateLinesResult.error;
        }
        templateLines = templateLinesResult.data || [];
      }

      // Fetch budget lines and transactions if we have budgets
      if (budgetIds.length > 0) {
        const [budgetLinesResult, transactionsResult] = await Promise.all([
          supabase
            .from('budget_line')
            .select('*')
            .in('budget_id', budgetIds)
            .order('created_at', { ascending: true }),

          supabase
            .from('transaction')
            .select('*')
            .in('budget_id', budgetIds)
            .order('transaction_date', { ascending: true }),
        ]);

        if (budgetLinesResult.error) {
          this.#logger.error(
            'Error fetching budget lines',
            budgetLinesResult.error,
          );
          throw budgetLinesResult.error;
        }
        if (transactionsResult.error) {
          this.#logger.error(
            'Error fetching transactions',
            transactionsResult.error,
          );
          throw transactionsResult.error;
        }

        budgetLines = budgetLinesResult.data || [];
        transactions = transactionsResult.data || [];
      }

      // Calculate metadata
      const dateRange = {
        oldest_budget:
          monthlyBudgets.length > 0
            ? `${monthlyBudgets[0].year}-${String(monthlyBudgets[0].month).padStart(2, '0')}-01`
            : null,
        newest_budget:
          monthlyBudgets.length > 0
            ? `${monthlyBudgets[monthlyBudgets.length - 1].year}-${String(
                monthlyBudgets[monthlyBudgets.length - 1].month,
              ).padStart(2, '0')}-01`
            : null,
      };

      const exportData: ExportData = {
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        user_id: userId,
        data: {
          templates,
          template_lines: templateLines,
          monthly_budgets: monthlyBudgets,
          budget_lines: budgetLines,
          transactions,
          savings_goals: savingsGoals,
        },
        metadata: {
          total_templates: templates.length,
          total_budgets: monthlyBudgets.length,
          total_transactions: transactions.length,
          total_savings_goals: savingsGoals.length,
          date_range: dateRange,
        },
      };

      // Log summary for debugging
      this.#logger.log(
        `Export data prepared for user ${userId}: ${templates.length} templates, ${monthlyBudgets.length} budgets, ${transactions.length} transactions`,
      );

      // Validate the export data against schema
      const validated = exportDataSchema.parse(exportData);
      return validated;
    } catch (error) {
      this.#logger.error('Error exporting user data', error);
      throw new BadRequestException('Failed to export user data');
    }
  }

  /**
   * Import user data from JSON format
   */
  // eslint-disable-next-line max-lines-per-function, complexity
  async importUserData(
    userId: string,
    importData: ExportData,
    supabase: AuthenticatedSupabaseClient,
    mode: ImportMode = ImportMode.REPLACE,
    dryRun: boolean = false,
  ): Promise<ImportResultDto> {
    try {
      // Validate the import data
      const validated = exportDataSchema.parse(importData);

      // Check version compatibility
      if (validated.version !== '1.0.0') {
        throw new BadRequestException(
          `Unsupported data version: ${validated.version}`,
        );
      }

      const result: ImportResultDto = {
        success: false,
        message: '',
        imported: {
          templates: 0,
          template_lines: 0,
          monthly_budgets: 0,
          budget_lines: 0,
          transactions: 0,
          savings_goals: 0,
        },
        errors: [],
        warnings: [],
      };

      // If dry run, just validate and return counts
      if (dryRun) {
        result.success = true;
        result.message =
          'Dry run completed successfully. No data was imported.';
        result.imported = {
          templates: validated.data.templates.length,
          template_lines: validated.data.template_lines.length,
          monthly_budgets: validated.data.monthly_budgets.length,
          budget_lines: validated.data.budget_lines.length,
          transactions: validated.data.transactions.length,
          savings_goals: validated.data.savings_goals.length,
        };
        return result;
      }

      // Handle different import modes
      if (mode === ImportMode.REPLACE) {
        // Delete existing user data in reverse dependency order
        await this.deleteUserData(userId, supabase);
      }

      // Create ID mappings for relational data
      const templateIdMap = new Map<string, string>();
      const templateLineIdMap = new Map<string, string>();
      const budgetIdMap = new Map<string, string>();
      const savingsGoalIdMap = new Map<string, string>();

      // Import savings goals first (no dependencies)
      for (const goal of validated.data.savings_goals) {
        const newGoal = { ...goal, user_id: userId };

        if (mode === ImportMode.APPEND) {
          // Generate new ID for append mode
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (newGoal as any).id;
        }

        const { data, error } = await supabase
          .from('savings_goal')
          .upsert(newGoal)
          .select()
          .single();

        if (error) {
          result.errors?.push(`Failed to import savings goal: ${goal.name}`);
          continue;
        }

        if (data) {
          savingsGoalIdMap.set(goal.id, data.id);
          result.imported.savings_goals++;
        }
      }

      // Import templates
      for (const template of validated.data.templates) {
        const newTemplate = { ...template, user_id: userId };

        if (mode === ImportMode.APPEND) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (newTemplate as any).id;
        }

        const { data, error } = await supabase
          .from('template')
          .upsert(newTemplate)
          .select()
          .single();

        if (error) {
          result.errors?.push(`Failed to import template: ${template.name}`);
          continue;
        }

        if (data) {
          templateIdMap.set(template.id, data.id);
          result.imported.templates++;
        }
      }

      // Import template lines
      for (const line of validated.data.template_lines) {
        const templateId =
          templateIdMap.get(line.template_id) || line.template_id;
        const newLine = { ...line, template_id: templateId };

        if (mode === ImportMode.APPEND) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (newLine as any).id;
        }

        const { data, error } = await supabase
          .from('template_line')
          .upsert(newLine)
          .select()
          .single();

        if (error) {
          result.errors?.push(`Failed to import template line: ${line.name}`);
          continue;
        }

        if (data) {
          templateLineIdMap.set(line.id, data.id);
          result.imported.template_lines++;
        }
      }

      // Import monthly budgets
      for (const budget of validated.data.monthly_budgets) {
        const templateId =
          templateIdMap.get(budget.template_id) || budget.template_id;
        const newBudget = {
          ...budget,
          user_id: userId,
          template_id: templateId,
        };

        if (mode === ImportMode.APPEND) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (newBudget as any).id;
        }

        const { data, error } = await supabase
          .from('monthly_budget')
          .upsert(newBudget)
          .select()
          .single();

        if (error) {
          result.errors?.push(
            `Failed to import budget: ${budget.year}-${budget.month}`,
          );
          continue;
        }

        if (data) {
          budgetIdMap.set(budget.id, data.id);
          result.imported.monthly_budgets++;
        }
      }

      // Import budget lines
      for (const line of validated.data.budget_lines) {
        const budgetId = budgetIdMap.get(line.budget_id) || line.budget_id;
        const templateLineId = line.template_line_id
          ? templateLineIdMap.get(line.template_line_id) ||
            line.template_line_id
          : null;
        const savingsGoalId = line.savings_goal_id
          ? savingsGoalIdMap.get(line.savings_goal_id) || line.savings_goal_id
          : null;

        const newLine = {
          ...line,
          budget_id: budgetId,
          template_line_id: templateLineId,
          savings_goal_id: savingsGoalId,
        };

        if (mode === ImportMode.APPEND) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (newLine as any).id;
        }

        const { error } = await supabase.from('budget_line').upsert(newLine);

        if (error) {
          result.errors?.push(`Failed to import budget line: ${line.name}`);
          continue;
        }

        result.imported.budget_lines++;
      }

      // Import transactions
      for (const transaction of validated.data.transactions) {
        const budgetId =
          budgetIdMap.get(transaction.budget_id) || transaction.budget_id;
        const newTransaction = { ...transaction, budget_id: budgetId };

        if (mode === ImportMode.APPEND) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          delete (newTransaction as any).id;
        }

        const { error } = await supabase
          .from('transaction')
          .upsert(newTransaction);

        if (error) {
          result.errors?.push(
            `Failed to import transaction: ${transaction.name}`,
          );
          continue;
        }

        result.imported.transactions++;
      }

      result.success = result.errors?.length === 0;
      result.message = result.success
        ? 'Data imported successfully'
        : 'Data imported with some errors';

      return result;
    } catch (error) {
      this.#logger.error('Error importing user data', error);
      throw new BadRequestException('Failed to import user data');
    }
  }

  /**
   * Delete all user data (used for REPLACE mode)
   */
  // eslint-disable-next-line max-lines-per-function
  private async deleteUserData(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    // Get all user's budget IDs and template IDs first
    const { data: budgets } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('user_id', userId);

    const { data: templates } = await supabase
      .from('template')
      .select('id')
      .eq('user_id', userId);

    const budgetIds = budgets?.map((b) => b.id) || [];
    const templateIds = templates?.map((t) => t.id) || [];

    // Delete in reverse dependency order
    if (budgetIds.length > 0) {
      // Delete transactions
      const { error: transactionError } = await supabase
        .from('transaction')
        .delete()
        .in('budget_id', budgetIds);
      if (transactionError) {
        this.#logger.warn('Error deleting transactions', transactionError);
      }

      // Delete budget lines
      const { error: budgetLineError } = await supabase
        .from('budget_line')
        .delete()
        .in('budget_id', budgetIds);
      if (budgetLineError) {
        this.#logger.warn('Error deleting budget lines', budgetLineError);
      }
    }

    // Delete monthly budgets
    const { error: budgetError } = await supabase
      .from('monthly_budget')
      .delete()
      .eq('user_id', userId);
    if (budgetError) {
      this.#logger.warn('Error deleting monthly budgets', budgetError);
    }

    if (templateIds.length > 0) {
      // Delete template lines
      const { error: templateLineError } = await supabase
        .from('template_line')
        .delete()
        .in('template_id', templateIds);
      if (templateLineError) {
        this.#logger.warn('Error deleting template lines', templateLineError);
      }
    }

    // Delete templates
    const { error: templateError } = await supabase
      .from('template')
      .delete()
      .eq('user_id', userId);
    if (templateError) {
      this.#logger.warn('Error deleting templates', templateError);
    }

    // Delete savings goals
    const { error: savingsGoalError } = await supabase
      .from('savings_goal')
      .delete()
      .eq('user_id', userId);
    if (savingsGoalError) {
      this.#logger.warn('Error deleting savings goals', savingsGoalError);
    }
  }
}
