import { Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { EncryptionService } from './encryption.service';

@Injectable()
export class EncryptionRekeyService {
  readonly #logger = new Logger(EncryptionRekeyService.name);
  readonly #encryptionService: EncryptionService;

  constructor(encryptionService: EncryptionService) {
    this.#encryptionService = encryptionService;
  }

  async reEncryptAllUserData(
    userId: string,
    oldDek: Buffer,
    newDek: Buffer,
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
      this.#fetchEncryptedBudgetLines(budgetIds, supabase),
      this.#fetchEncryptedTransactions(budgetIds, supabase),
      this.#fetchEncryptedTemplateLines(templateIds, supabase),
      this.#fetchEncryptedSavingsGoals(userId, supabase),
      this.#fetchEncryptedMonthlyBudgets(userId, supabase),
    ]);

    const payloads = this.#buildRekeyPayloads(
      {
        budgetLines,
        transactions,
        templateLines,
        savingsGoals,
        monthlyBudgets,
      },
      oldDek,
      newDek,
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
        operation: 'rekey.complete',
        counts: {
          budget_line: payloads.budgetLines.length,
          transaction: payloads.transactions.length,
          template_line: payloads.templateLines.length,
          savings_goal: payloads.savingsGoals.length,
          monthly_budget: payloads.monthlyBudgets.length,
        },
      },
      'All user data re-encrypted atomically',
    );
  }

  #buildRekeyPayloads(
    rows: {
      budgetLines: Array<{
        id: string;
        amount: number;
        amount_encrypted: string | null;
      }>;
      transactions: Array<{
        id: string;
        amount: number;
        amount_encrypted: string | null;
      }>;
      templateLines: Array<{
        id: string;
        amount: number;
        amount_encrypted: string | null;
      }>;
      savingsGoals: Array<{
        id: string;
        target_amount: number;
        target_amount_encrypted: string | null;
      }>;
      monthlyBudgets: Array<{
        id: string;
        ending_balance: number | null;
        ending_balance_encrypted: string | null;
      }>;
    },
    oldDek: Buffer,
    newDek: Buffer,
  ) {
    const rekey = (ciphertext: string, fallback: number) =>
      this.#reEncryptAmount(ciphertext, fallback, oldDek, newDek);

    return {
      budgetLines: rows.budgetLines.map((r) => ({
        id: r.id,
        amount_encrypted: rekey(r.amount_encrypted!, r.amount),
      })),
      transactions: rows.transactions.map((r) => ({
        id: r.id,
        amount_encrypted: rekey(r.amount_encrypted!, r.amount),
      })),
      templateLines: rows.templateLines.map((r) => ({
        id: r.id,
        amount_encrypted: rekey(r.amount_encrypted!, r.amount),
      })),
      savingsGoals: rows.savingsGoals.map((r) => ({
        id: r.id,
        target_amount_encrypted: rekey(
          r.target_amount_encrypted!,
          r.target_amount,
        ),
      })),
      monthlyBudgets: rows.monthlyBudgets.map((r) => ({
        id: r.id,
        ending_balance_encrypted: rekey(
          r.ending_balance_encrypted!,
          r.ending_balance ?? 0,
        ),
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

  async #fetchEncryptedBudgetLines(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('budget_line')
      .select('id, amount, amount_encrypted')
      .not('amount_encrypted', 'is', null)
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchEncryptedTransactions(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('transaction')
      .select('id, amount, amount_encrypted')
      .not('amount_encrypted', 'is', null)
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchEncryptedTemplateLines(
    templateIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!templateIds.length) return [];

    const { data, error } = await supabase
      .from('template_line')
      .select('id, amount, amount_encrypted')
      .not('amount_encrypted', 'is', null)
      .in('template_id', templateIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchEncryptedSavingsGoals(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('savings_goal')
      .select('id, target_amount, target_amount_encrypted')
      .eq('user_id', userId)
      .not('target_amount_encrypted', 'is', null);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchEncryptedMonthlyBudgets(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, ending_balance, ending_balance_encrypted')
      .eq('user_id', userId)
      .not('ending_balance_encrypted', 'is', null);

    if (error) throw error;
    return data ?? [];
  }

  #reEncryptAmount(
    ciphertext: string,
    fallbackAmount: number,
    oldDek: Buffer,
    newDek: Buffer,
  ): string {
    const plaintext = this.#encryptionService.tryDecryptAmount(
      ciphertext,
      oldDek,
      fallbackAmount,
    );
    return this.#encryptionService.encryptAmount(plaintext, newDek);
  }
}
