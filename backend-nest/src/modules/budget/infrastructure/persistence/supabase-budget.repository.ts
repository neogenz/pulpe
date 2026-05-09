import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { ZodError } from 'zod';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import { BudgetFormulas, type TransactionKind } from 'pulpe-shared';
import type {
  Budget,
  BudgetForRollover,
  BudgetLineDecrypted,
  BudgetLineRow,
  BudgetRow,
  BudgetUpdatePatch,
  BudgetWithRelations,
  TransactionDecrypted,
  TransactionRow,
  BudgetAggregates,
} from '../../domain/budget.entity';
import type { BudgetRepositoryPort } from '../../domain/ports/budget-repository.port';
import { validateCreateBudgetResponse } from '../../schemas/rpc-responses.schema';

export type { BudgetAggregates };

@Injectable()
export class SupabaseBudgetRepository implements BudgetRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async hasAnyBudget(): Promise<boolean> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'hasBudgets',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data !== null;
  }

  async fetchAllBudgets(): Promise<Budget[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgets',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toEntity(row, dek));
  }

  async fetchBudgetsWithFilters(filters: {
    limit?: number;
    year?: number;
  }): Promise<Budget[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (filters.limit) query = query.limit(filters.limit);
    if (filters.year) query = query.eq('year', filters.year);

    const { data, error } = await query;

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetsSparse',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toEntity(row, dek));
  }

  async fetchAllBudgetsForExport(): Promise<Budget[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: true })
      .order('month', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'exportAllBudgets',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toEntity(row, dek));
  }

  async fetchBudgetById(id: string, userId: string): Promise<Budget> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'getBudget',
          userId,
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
      );
    }

    const dek = await this.getDek();
    return this.toEntity(data, dek);
  }

  async fetchBudgetUserId(id: string): Promise<string> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('user_id')
      .eq('id', id)
      .single();

    if (error || !data?.user_id) {
      throw new BusinessException(ERROR_DEFINITIONS.BUDGET_NOT_FOUND, { id });
    }

    return data.user_id;
  }

  async validateBudgetExists(id: string): Promise<Budget> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'getBudgetWithDetails',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
      );
    }

    const dek = await this.getDek();
    return this.toEntity(data, dek);
  }

  async updateBudget(id: string, patch: BudgetUpdatePatch): Promise<Budget> {
    const supabase = this.supabaseProvider.client;
    const updateRow = this.toUpdateRow(patch);
    const { data, error } = await supabase
      .from('monthly_budget')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'updateBudgetInDb',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    const dek = await this.getDek();
    return this.toEntity(data, dek);
  }

  async deleteBudget(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id },
        {
          operation: 'deleteBudget',
          entityId: id,
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  async deleteBudgetsByIds(ids: string[]): Promise<boolean> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .in('id', ids);
    return !error;
  }

  async getExistingPeriods(
    userId: string,
    targetMonths: { month: number; year: number }[],
  ): Promise<Set<string>> {
    if (targetMonths.length === 0) return new Set();

    const supabase = this.supabaseProvider.client;
    const periodFilters = targetMonths
      .map((t) => `and(month.eq.${t.month},year.eq.${t.year})`)
      .join(',');

    const { data, error } = await supabase
      .from('monthly_budget')
      .select('month, year')
      .eq('user_id', userId)
      .or(periodFilters);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'getExistingPeriods',
          entityType: 'budget',
        },
        { cause: error },
      );
    }

    return new Set(
      (data ?? []).map(
        (row: { month: number; year: number }) => `${row.month}/${row.year}`,
      ),
    );
  }

  async fetchBudgetData(budgetId: string): Promise<BudgetWithRelations> {
    const supabase = this.supabaseProvider.client;
    const [budgetResult, budgetLinesResult, transactionsResult] =
      await Promise.all([
        supabase.from('monthly_budget').select('*').eq('id', budgetId).single(),
        supabase
          .from('budget_line')
          .select('*')
          .eq('budget_id', budgetId)
          .order('created_at', { ascending: false }),
        supabase
          .from('transaction')
          .select('*')
          .eq('budget_id', budgetId)
          .order('transaction_date', { ascending: false }),
      ]);

    if (budgetResult.error || !budgetResult.data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
        { id: budgetId },
        {
          operation: 'fetchBudget',
          entityId: budgetId,
          entityType: 'budget',
        },
        { cause: budgetResult.error },
      );
    }

    if (budgetLinesResult.error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        { budgetId },
        {
          operation: 'fetchBudgetLines',
          entityId: budgetId,
          entityType: 'budgetLines',
        },
        { cause: budgetLinesResult.error },
      );
    }

    if (transactionsResult.error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        { budgetId },
        {
          operation: 'fetchTransactions',
          entityId: budgetId,
          entityType: 'transactions',
        },
        { cause: transactionsResult.error },
      );
    }

    const dek = await this.getDek();
    return {
      budget: this.toEntity(budgetResult.data, dek),
      budgetLines: (budgetLinesResult.data ?? []).map((row) =>
        this.toBudgetLineDecrypted(row, dek),
      ),
      transactions: (transactionsResult.data ?? []).map((row) =>
        this.toTransactionDecrypted(row, dek),
      ),
    };
  }

  async createBudgetFromTemplateRpc(payload: {
    p_user_id: string;
    p_template_id: string;
    p_month: number;
    p_year: number;
    p_description: string;
  }): Promise<{
    budget: BudgetRow;
    budget_lines_created: number;
    template_name: string;
  }> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase.rpc(
      'create_budget_from_template',
      payload,
    );

    if (error) {
      throw error;
    }

    try {
      const validated = validateCreateBudgetResponse(data);
      return {
        budget: validated.budget as BudgetRow,
        budget_lines_created: validated.budget_lines_created,
        template_name: validated.template_name,
      };
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_CREATE_FAILED,
          { reason: 'Invalid result structure from RPC' },
          {
            operation: 'createBudgetFromTemplateRpc',
            validationErrors: err.issues,
          },
          { cause: err },
        );
      }
      throw err;
    }
  }

  async persistEndingBalance(
    budgetId: string,
    endingBalance: number,
  ): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const dek = await this.encryption.ensureUserDEK(user.id, user.clientKey);
    const encryptedBalance = this.encryption.encryptAmount(endingBalance, dek);

    const { error } = await supabase
      .from('monthly_budget')
      .update({ ending_balance: encryptedBalance })
      .eq('id', budgetId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_UPDATE_FAILED,
        { budgetId },
        {
          operation: 'persistEndingBalance',
          entityId: budgetId,
          entityType: 'monthly_budget',
        },
        { cause: error },
      );
    }
  }

  async fetchAllBudgetsForRollover(
    userId: string,
  ): Promise<BudgetForRollover[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year, ending_balance')
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchAllBudgetsForRollover',
          entityType: 'budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];

    const hasEncryptedData = data.some((b) => b.ending_balance);
    const dek = hasEncryptedData ? await this.getDek() : null;

    return data.map((row) => ({
      id: row.id,
      month: row.month,
      year: row.year,
      endingBalance:
        row.ending_balance && dek
          ? this.encryption.tryDecryptAmount(row.ending_balance, dek, 0)
          : null,
    }));
  }

  async fetchBudgetAggregates(
    budgetIds: string[],
  ): Promise<Map<string, BudgetAggregates>> {
    const aggregatesMap = new Map<string, BudgetAggregates>();

    if (budgetIds.length === 0) return aggregatesMap;

    for (const budgetId of budgetIds) {
      aggregatesMap.set(budgetId, {
        totalExpenses: 0,
        totalSavings: 0,
        totalIncome: 0,
      });
    }

    const supabase = this.supabaseProvider.client;
    const [budgetLinesResult, transactionsResult] = await Promise.all([
      supabase
        .from('budget_line')
        .select('id, budget_id, kind, amount')
        .in('budget_id', budgetIds),
      supabase
        .from('transaction')
        .select('budget_id, kind, amount, budget_line_id')
        .in('budget_id', budgetIds),
    ]);

    const budgetLines = budgetLinesResult.data ?? [];
    const transactions = transactionsResult.data ?? [];

    const hasEncryptedData =
      budgetLines.some((l) => l.amount) || transactions.some((t) => t.amount);
    const dek = hasEncryptedData ? await this.getDek() : null;

    const decrypt = (ciphertext: string | null): number =>
      ciphertext && dek
        ? this.encryption.tryDecryptAmount(ciphertext, dek, 0)
        : 0;

    this.computeEnvelopeAggregates(
      budgetLines,
      transactions,
      aggregatesMap,
      decrypt,
    );

    return aggregatesMap;
  }

  async fetchBudgetIdByPeriod(
    month: number,
    year: number,
  ): Promise<string | null> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .maybeSingle();

    return data?.id ?? null;
  }

  async fetchBudgetIdByPeriodExcluding(
    month: number,
    year: number,
    excludeId: string,
  ): Promise<string | null> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .neq('id', excludeId)
      .maybeSingle();

    return data?.id ?? null;
  }

  private async getDek(): Promise<Buffer> {
    const user = this.supabaseProvider.user;
    return this.encryption.getUserDEK(user.id, user.clientKey);
  }

  private toEntity(row: BudgetRow, dek: Buffer): Budget {
    return {
      id: row.id,
      userId: row.user_id,
      templateId: row.template_id,
      month: row.month,
      year: row.year,
      description: row.description,
      endingBalance: row.ending_balance
        ? this.encryption.tryDecryptAmount(row.ending_balance, dek, 0)
        : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toBudgetLineDecrypted(
    row: BudgetLineRow,
    dek: Buffer,
  ): BudgetLineDecrypted {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      templateLineId: decrypted.template_line_id,
      savingsGoalId: decrypted.savings_goal_id,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency: decrypted.original_currency,
      targetCurrency: decrypted.target_currency,
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      recurrence: decrypted.recurrence,
      isManuallyAdjusted: decrypted.is_manually_adjusted,
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
    };
  }

  private toTransactionDecrypted(
    row: TransactionRow,
    dek: Buffer,
  ): TransactionDecrypted {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      budgetLineId: decrypted.budget_line_id,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency: decrypted.original_currency,
      targetCurrency: decrypted.target_currency,
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      category: decrypted.category,
      transactionDate: decrypted.transaction_date,
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
    };
  }

  private toUpdateRow(patch: BudgetUpdatePatch): Record<string, unknown> {
    const updateData: Record<string, unknown> = {};
    if (patch.month !== undefined) updateData.month = patch.month;
    if (patch.year !== undefined) updateData.year = patch.year;
    if (patch.description !== undefined)
      updateData.description = patch.description;
    if (patch.templateId !== undefined)
      updateData.template_id = patch.templateId;
    return updateData;
  }

  private computeEnvelopeAggregates(
    budgetLines: Array<{
      id: string;
      budget_id: string;
      kind: TransactionKind;
      amount: string | null;
    }>,
    transactions: Array<{
      budget_id: string;
      kind: TransactionKind;
      amount: string | null;
      budget_line_id: string | null;
    }>,
    aggregatesMap: Map<string, BudgetAggregates>,
    decryptFn: (amount: string | null) => number,
  ): void {
    const linesByBudget = this.groupByBudgetId(budgetLines);
    const txsByBudget = this.groupByBudgetId(transactions);

    for (const [budgetId, aggregates] of aggregatesMap) {
      const lines = (linesByBudget.get(budgetId) ?? []).map((l) => ({
        id: l.id,
        kind: l.kind,
        amount: decryptFn(l.amount),
      }));

      const txs = (txsByBudget.get(budgetId) ?? []).map((t) => ({
        kind: t.kind,
        amount: decryptFn(t.amount),
        budgetLineId: t.budget_line_id,
      }));

      const metrics = BudgetFormulas.calculateAllMetrics(lines, txs);
      aggregates.totalExpenses = metrics.totalExpenses;
      aggregates.totalIncome = metrics.totalIncome;
      aggregates.totalSavings = metrics.totalSavings;
    }
  }

  private groupByBudgetId<T extends { budget_id: string }>(
    items: T[],
  ): Map<string, T[]> {
    const map = new Map<string, T[]>();
    for (const item of items) {
      if (!map.has(item.budget_id)) map.set(item.budget_id, []);
      map.get(item.budget_id)!.push(item);
    }
    return map;
  }
}
