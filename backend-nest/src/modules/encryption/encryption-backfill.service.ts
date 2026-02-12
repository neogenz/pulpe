import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { EncryptionService } from './encryption.service';

@Injectable()
export class EncryptionBackfillService {
  readonly #logger = new Logger(EncryptionBackfillService.name);
  readonly #encryptionService: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    this.#encryptionService = encryptionService;
  }

  async backfillUserData(
    userId: string,
    dek: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const [budgetIds, templateIds] = await Promise.all([
      this.#fetchUserBudgetIds(userId, supabase),
      this.#fetchUserTemplateIds(userId, supabase),
    ]);

    const [
      budgetLines,
      transactions,
      templateLines,
      savingsGoals,
      monthlyBudgets,
    ] = await Promise.all([
      this.#fetchUnencryptedBudgetLines(budgetIds, supabase),
      this.#fetchUnencryptedTransactions(budgetIds, supabase),
      this.#fetchUnencryptedTemplateLines(templateIds, supabase),
      this.#fetchUnencryptedSavingsGoals(userId, supabase),
      this.#fetchUnencryptedMonthlyBudgets(userId, supabase),
    ]);

    const totalRows =
      budgetLines.length +
      transactions.length +
      templateLines.length +
      savingsGoals.length +
      monthlyBudgets.length;

    if (totalRows === 0) {
      this.#logger.debug(
        { userId, operation: 'backfill.skip' },
        'No unencrypted data to backfill',
      );
      return;
    }

    const payloads = this.#buildBackfillPayloads(
      {
        budgetLines,
        transactions,
        templateLines,
        savingsGoals,
        monthlyBudgets,
      },
      dek,
    );

    const { error } = await supabase.rpc('rekey_user_encrypted_data', {
      p_budget_lines: payloads.budgetLines,
      p_transactions: payloads.transactions,
      p_template_lines: payloads.templateLines,
      p_savings_goals: payloads.savingsGoals,
      p_monthly_budgets: payloads.monthlyBudgets,
    });
    if (error) throw error;

    this.#logger.log(
      {
        userId,
        operation: 'backfill.complete',
        counts: {
          budget_line: payloads.budgetLines.length,
          transaction: payloads.transactions.length,
          template_line: payloads.templateLines.length,
          savings_goal: payloads.savingsGoals.length,
          monthly_budget: payloads.monthlyBudgets.length,
        },
      },
      'User data backfill-encrypted atomically',
    );
  }

  #buildBackfillPayloads(
    rows: {
      budgetLines: Array<{ id: string; amount: number }>;
      transactions: Array<{ id: string; amount: number }>;
      templateLines: Array<{ id: string; amount: number }>;
      savingsGoals: Array<{ id: string; target_amount: number }>;
      monthlyBudgets: Array<{ id: string; ending_balance: number | null }>;
    },
    dek: Buffer,
  ) {
    const encrypt = (amount: number) =>
      this.#encryptionService.encryptAmount(amount, dek);

    return {
      budgetLines: rows.budgetLines.map((r) => ({
        id: r.id,
        amount_encrypted: encrypt(r.amount),
      })),
      transactions: rows.transactions.map((r) => ({
        id: r.id,
        amount_encrypted: encrypt(r.amount),
      })),
      templateLines: rows.templateLines.map((r) => ({
        id: r.id,
        amount_encrypted: encrypt(r.amount),
      })),
      savingsGoals: rows.savingsGoals.map((r) => ({
        id: r.id,
        target_amount_encrypted: encrypt(r.target_amount),
      })),
      monthlyBudgets: rows.monthlyBudgets.map((r) => ({
        id: r.id,
        ending_balance_encrypted: encrypt(r.ending_balance ?? 0),
      })),
    };
  }

  async #fetchUserBudgetIds(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map((b) => b.id) ?? [];
  }

  async #fetchUserTemplateIds(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from('template')
      .select('id')
      .eq('user_id', userId);

    if (error) throw error;
    return data?.map((t) => t.id) ?? [];
  }

  async #fetchUnencryptedBudgetLines(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('budget_line')
      .select('id, amount')
      .is('amount_encrypted', null)
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchUnencryptedTransactions(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('transaction')
      .select('id, amount')
      .is('amount_encrypted', null)
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchUnencryptedTemplateLines(
    templateIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!templateIds.length) return [];

    const { data, error } = await supabase
      .from('template_line')
      .select('id, amount')
      .is('amount_encrypted', null)
      .in('template_id', templateIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchUnencryptedSavingsGoals(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('savings_goal')
      .select('id, target_amount')
      .eq('user_id', userId)
      .is('target_amount_encrypted', null);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchUnencryptedMonthlyBudgets(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, ending_balance')
      .eq('user_id', userId)
      .is('ending_balance_encrypted', null);

    if (error) throw error;
    return data ?? [];
  }
}
