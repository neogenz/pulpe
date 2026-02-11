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

  /**
   * Re-encrypt all user data using client keys.
   * Derives DEKs from client keys and then performs rekey operation.
   * Used during vault code setup migration.
   */
  async rekeyUserData(
    userId: string,
    oldClientKey: Buffer,
    newClientKey: Buffer,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const oldDek = await this.#encryptionService.getUserDEK(
      userId,
      oldClientKey,
    );
    const newDek = await this.#encryptionService.ensureUserDEK(
      userId,
      newClientKey,
    );

    await this.reEncryptAllUserData(userId, oldDek, newDek, supabase);
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
      this.#fetchBudgetLines(budgetIds, supabase),
      this.#fetchTransactions(budgetIds, supabase),
      this.#fetchTemplateLines(templateIds, supabase),
      this.#fetchSavingsGoals(userId, supabase),
      this.#fetchMonthlyBudgets(userId, supabase),
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
    const rekey = (ciphertext: string | null, fallback: number) =>
      ciphertext
        ? this.#reEncryptAmountStrict(ciphertext, oldDek, newDek)
        : this.#encryptionService.encryptAmount(fallback, newDek);

    return {
      budgetLines: rows.budgetLines.map((r) => ({
        id: r.id,
        amount_encrypted: rekey(r.amount_encrypted, r.amount),
      })),
      transactions: rows.transactions.map((r) => ({
        id: r.id,
        amount_encrypted: rekey(r.amount_encrypted, r.amount),
      })),
      templateLines: rows.templateLines.map((r) => ({
        id: r.id,
        amount_encrypted: rekey(r.amount_encrypted, r.amount),
      })),
      savingsGoals: rows.savingsGoals.map((r) => ({
        id: r.id,
        target_amount_encrypted: rekey(
          r.target_amount_encrypted,
          r.target_amount,
        ),
      })),
      monthlyBudgets: rows.monthlyBudgets.map((r) => ({
        id: r.id,
        ending_balance_encrypted: rekey(
          r.ending_balance_encrypted,
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

  async #fetchBudgetLines(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('budget_line')
      .select('id, amount, amount_encrypted')
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchTransactions(
    budgetIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!budgetIds.length) return [];

    const { data, error } = await supabase
      .from('transaction')
      .select('id, amount, amount_encrypted')
      .in('budget_id', budgetIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchTemplateLines(
    templateIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ) {
    if (!templateIds.length) return [];

    const { data, error } = await supabase
      .from('template_line')
      .select('id, amount, amount_encrypted')
      .in('template_id', templateIds);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchSavingsGoals(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('savings_goal')
      .select('id, target_amount, target_amount_encrypted')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  }

  async #fetchMonthlyBudgets(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ) {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, ending_balance, ending_balance_encrypted')
      .eq('user_id', userId);

    if (error) throw error;
    return data ?? [];
  }

  #reEncryptAmountStrict(
    ciphertext: string,
    oldDek: Buffer,
    newDek: Buffer,
  ): string {
    const plaintext = this.#encryptionService.decryptAmount(ciphertext, oldDek);
    return this.#encryptionService.encryptAmount(plaintext, newDek);
  }
}
