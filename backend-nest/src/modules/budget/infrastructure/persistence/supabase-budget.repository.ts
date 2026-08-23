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
import {
  BudgetFormulas,
  getBudgetPeriodForDate,
  parseIsoDateLocal,
  periodIndex,
  type BudgetPeriod,
  type TransactionKind,
} from 'pulpe-shared';
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
import type {
  BudgetDataForRecalc,
  BudgetRepositoryPort,
} from '../../domain/ports/budget-repository.port';
import type { HistoryMonth } from '../../domain/drift-history';
import type {
  MaterializedBudgetPeriod,
  SavingsGoalHorizonPort,
} from '../../domain/ports/savings-goal-horizon.port';
import { validateCreateBudgetResponse } from '../../schemas/rpc-responses.schema';

export type { BudgetAggregates };

/** Embedded junction rows so budget details reads map to tagIds (PUL-18). */
type BudgetLineRowWithTags = BudgetLineRow & {
  budget_line_tag?: { tag_id: string }[];
};
type TransactionRowWithTags = TransactionRow & {
  transaction_tag?: { tag_id: string }[];
};

@Injectable()
export class SupabaseBudgetRepository
  implements BudgetRepositoryPort, SavingsGoalHorizonPort
{
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
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async fetchBudgetsWithFilters(filters: {
    limit?: number;
    offset?: number;
    year?: number;
  }): Promise<Budget[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('monthly_budget')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (filters.year) query = query.eq('year', filters.year);
    if (filters.limit !== undefined) {
      const offset = filters.offset ?? 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

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
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
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
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async fetchBudgetById(id: string, userId: string): Promise<Budget> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('id', id)
      // Explicit ownership filter on top of RLS — defense-in-depth + optimizer
      // hint (see .claude/rules/.../supabase.md).
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      throw this.budgetReadError(error, id, {
        operation: 'getBudget',
        userId,
        entityId: id,
        entityType: 'budget',
      });
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
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
      throw this.budgetReadError(error, id, {
        operation: 'fetchBudgetUserId',
        entityId: id,
        entityType: 'budget',
      });
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
      throw this.budgetReadError(error, id, {
        operation: 'getBudgetWithDetails',
        entityId: id,
        entityType: 'budget',
      });
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
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
      throw this.budgetReadError(error, id, {
        operation: 'updateBudgetInDb',
        entityId: id,
        entityType: 'budget',
      });
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(data, dek);
  }

  async deleteBudget(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase
      .from('monthly_budget')
      .delete()
      .eq('id', id);

    if (error) {
      // Deletes never return PGRST116 (no `.single()`), so any error here is an
      // infra failure — budgetReadError routes it to BUDGET_FETCH_FAILED, never
      // a lying 404. Deleting an absent row is a no-op success (0 rows, no error).
      throw this.budgetReadError(error, id, {
        operation: 'deleteBudget',
        entityId: id,
        entityType: 'budget',
      });
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
  ): Promise<Map<string, string>> {
    if (targetMonths.length === 0) return new Map();

    const supabase = this.supabaseProvider.client;
    const periodFilters = targetMonths
      .map((t) => `and(month.eq.${t.month},year.eq.${t.year})`)
      .join(',');

    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year')
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

    // periodKey → budgetId, so callers needing the id (spread provisioning) skip
    // a per-period follow-up query; existence-only callers use `.has()` as before.
    return new Map(
      (data ?? []).map(
        (row: {
          id: string;
          month: number;
          year: number;
        }): [string, string] => [`${row.month}/${row.year}`, row.id],
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
          .select('*, budget_line_tag(tag_id)')
          .eq('budget_id', budgetId)
          // `created_at` alone does not order these. Instantiating a budget
          // from a template inserts every line in one statement, so they share
          // a timestamp to the microsecond and Postgres falls back to physical
          // heap order — which an UPDATE moves. Checking a line therefore
          // reshuffled the list around it, and undoing the check did not put
          // the line back where it was. `id` is arbitrary; being stable is the
          // whole job.
          .order('created_at', { ascending: false })
          .order('id', { ascending: true }),
        supabase
          .from('transaction')
          .select('*, transaction_tag(tag_id)')
          .eq('budget_id', budgetId)
          .order('transaction_date', { ascending: false }),
      ]);

    if (budgetResult.error || !budgetResult.data) {
      throw this.budgetReadError(budgetResult.error, budgetId, {
        operation: 'fetchBudget',
        entityId: budgetId,
        entityType: 'budget',
      });
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

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
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

  async fetchBudgetDataForRecalc(
    budgetId: string,
  ): Promise<BudgetDataForRecalc> {
    const supabase = this.supabaseProvider.client;
    const [budgetLinesResult, transactionsResult] = await Promise.all([
      supabase
        .from('budget_line')
        .select('id, kind, amount')
        .eq('budget_id', budgetId),
      supabase
        .from('transaction')
        .select('kind, amount, budget_line_id')
        .eq('budget_id', budgetId),
    ]);

    if (budgetLinesResult.error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        { budgetId },
        {
          operation: 'fetchBudgetDataForRecalc',
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
          operation: 'fetchBudgetDataForRecalc',
          entityId: budgetId,
          entityType: 'transactions',
        },
        { cause: transactionsResult.error },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    // Strict on purpose: recalculation persists its result, so an
    // undecryptable ciphertext must abort the write instead of zeroing the
    // total (fetchBudgetData keeps the fail-open display behavior).
    const decryptStrict = (ciphertext: string | null): number => {
      if (!ciphertext) return 0;
      try {
        return this.encryption.decryptAmount(ciphertext, dek);
      } catch (error) {
        throw new BusinessException(
          ERROR_DEFINITIONS.ENCRYPTION_DECRYPT_FAILED,
          { budgetId },
          {
            operation: 'recalc.decrypt',
            entityId: budgetId,
            entityType: 'budget',
          },
          { cause: error instanceof Error ? error : new Error(String(error)) },
        );
      }
    };

    return {
      budgetLines: (budgetLinesResult.data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        amount: decryptStrict(row.amount),
      })),
      transactions: (transactionsResult.data ?? []).map((row) => ({
        kind: row.kind,
        amount: decryptStrict(row.amount),
        budgetLineId: row.budget_line_id,
      })),
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
    const { data, error } = await supabase.rpc('create_budget_from_template', {
      ...payload,
      p_excluded_savings_goal_ids: await this.goalIdsExcludedFromPeriod({
        month: payload.p_month,
        year: payload.p_year,
      }),
    });

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

  async goalIdsExcludedFromPeriod(period: BudgetPeriod): Promise<string[]> {
    const goals = await this.fetchGoalHorizons();
    const payDayOfMonth = this.supabaseProvider.user.payDayOfMonth ?? null;
    const budgetPeriodIndex = periodIndex(period);
    return goals
      .filter(
        (goal) =>
          budgetPeriodIndex < this.goalStartPeriodIndex(goal, payDayOfMonth) ||
          (goal.target_date != null &&
            periodIndex(
              getBudgetPeriodForDate(
                parseIsoDateLocal(goal.target_date),
                payDayOfMonth,
              ),
            ) < budgetPeriodIndex),
      )
      .map((goal) => goal.id);
  }

  async periodsOutsideInterval(
    goalIds: string[],
    periods: MaterializedBudgetPeriod[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const uniqueGoalIds = [...new Set(goalIds)];
    if (uniqueGoalIds.length === 0 || periods.length === 0) return new Map();

    const goals = await this.fetchGoalHorizons(uniqueGoalIds);
    const payDayOfMonth = this.supabaseProvider.user.payDayOfMonth ?? null;

    const exclusions: [string, string[]][] = goals.map((goal) => {
      const startPeriodIndex = this.goalStartPeriodIndex(goal, payDayOfMonth);
      const targetPeriodIndex =
        goal.target_date == null
          ? null
          : periodIndex(
              getBudgetPeriodForDate(
                parseIsoDateLocal(goal.target_date),
                payDayOfMonth,
              ),
            );
      return [
        goal.id,
        periods
          .filter((period) => {
            const index = periodIndex(period);
            return (
              index < startPeriodIndex ||
              (targetPeriodIndex != null && targetPeriodIndex < index)
            );
          })
          .map((period) => period.id),
      ];
    });

    return new Map(exclusions);
  }

  private async fetchGoalHorizons(goalIds?: string[]): Promise<
    {
      id: string;
      created_at: string;
      start_date: string | null;
      target_date: string | null;
    }[]
  > {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('savings_goal')
      .select('id, created_at, start_date, target_date')
      .eq('user_id', this.supabaseProvider.user.id);

    if (goalIds) {
      query = query.in('id', goalIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.DATABASE_QUERY_FAILED,
        { operation: 'fetchGoalHorizons' },
        {
          operation: 'fetchGoalHorizons',
          userId: this.supabaseProvider.user.id,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  private goalStartPeriodIndex(
    goal: {
      created_at: string;
      start_date: string | null;
    },
    payDayOfMonth: number | null,
  ): number {
    const currentIndex = periodIndex(
      getBudgetPeriodForDate(new Date(), payDayOfMonth),
    );
    const createdIndex = periodIndex(
      getBudgetPeriodForDate(new Date(goal.created_at), payDayOfMonth),
    );
    const explicitStartIndex =
      goal.start_date == null
        ? createdIndex
        : periodIndex(
            getBudgetPeriodForDate(
              parseIsoDateLocal(goal.start_date),
              payDayOfMonth,
            ),
          );
    return Math.max(currentIndex, createdIndex, explicitStartIndex);
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
    const dek = hasEncryptedData
      ? await this.encryption.getDekFor(this.supabaseProvider.user)
      : null;

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
    const dek = hasEncryptedData
      ? await this.encryption.getDekFor(this.supabaseProvider.user)
      : null;

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

  async fetchHistoryData(
    budgets: { id: string; month: number; year: number }[],
  ): Promise<HistoryMonth[]> {
    if (budgets.length === 0) return [];
    const budgetIds = budgets.map((b) => b.id);

    const supabase = this.supabaseProvider.client;
    const [budgetLinesResult, transactionsResult] = await Promise.all([
      supabase
        .from('budget_line')
        .select('id, budget_id, kind, amount, checked_at')
        .in('budget_id', budgetIds),
      supabase
        .from('transaction')
        .select('budget_id, kind, amount, budget_line_id, transaction_date')
        .in('budget_id', budgetIds),
    ]);

    if (budgetLinesResult.error || transactionsResult.error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchHistoryData',
          entityType: 'budget',
          supabaseError: budgetLinesResult.error ?? transactionsResult.error,
        },
        { cause: budgetLinesResult.error ?? transactionsResult.error },
      );
    }

    const budgetLines = budgetLinesResult.data ?? [];
    const transactions = transactionsResult.data ?? [];

    const hasEncryptedData =
      budgetLines.some((l) => l.amount) || transactions.some((t) => t.amount);
    const dek = hasEncryptedData
      ? await this.encryption.getDekFor(this.supabaseProvider.user)
      : null;
    const decrypt = (ciphertext: string | null): number =>
      ciphertext && dek
        ? this.encryption.tryDecryptAmount(ciphertext, dek, 0)
        : 0;

    return budgets.map(({ id, month, year }) => ({
      month,
      year,
      budgetLines: budgetLines
        .filter((l) => l.budget_id === id)
        .map((l) => ({
          id: l.id,
          kind: l.kind,
          amount: decrypt(l.amount),
          checkedAt: l.checked_at,
        })),
      transactions: transactions
        .filter((t) => t.budget_id === id)
        .map((t) => ({
          kind: t.kind,
          amount: decrypt(t.amount),
          budgetLineId: t.budget_line_id,
          transactionDate: t.transaction_date,
        })),
    }));
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
      .eq('user_id', this.supabaseProvider.user.id)
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
      .eq('user_id', this.supabaseProvider.user.id)
      .neq('id', excludeId)
      .maybeSingle();

    return data?.id ?? null;
  }

  /**
   * PostgREST returns code `PGRST116` when a `.single()` matched zero rows — a
   * genuine 404. Any other error (statement timeout, PostgREST saturation,
   * permission) is an infra failure and must surface as 500, never a lying
   * "Budget not found". The original error rides the cause chain (not the
   * logging context) per "log or throw, not both".
   */
  private budgetReadError(
    error: { code?: string } | null | undefined,
    id: string,
    loggingContext: Record<string, unknown>,
  ): BusinessException {
    if (error && error.code !== 'PGRST116') {
      return new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        loggingContext,
        { cause: error },
      );
    }
    return new BusinessException(
      ERROR_DEFINITIONS.BUDGET_NOT_FOUND,
      { id },
      loggingContext,
    );
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
    row: BudgetLineRowWithTags,
    dek: Buffer,
  ): BudgetLineDecrypted {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      templateLineId: decrypted.template_line_id,
      savingsGoalId: decrypted.savings_goal_id,
      spreadGroupId: decrypted.spread_group_id ?? null,
      savingsWithdrawalGroupId: decrypted.savings_withdrawal_group_id ?? null,
      sourceSavingsGoalId: decrypted.source_savings_goal_id,
      sourceSavingsGoalName: decrypted.source_savings_goal_name,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency: decrypted.original_currency,
      targetCurrency: decrypted.target_currency,
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      recurrence: decrypted.recurrence,
      tagIds: (row.budget_line_tag ?? []).map((link) => link.tag_id),
      isManuallyAdjusted: decrypted.is_manually_adjusted,
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
    };
  }

  private toTransactionDecrypted(
    row: TransactionRowWithTags,
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
      transactionDate: decrypted.transaction_date,
      tagIds: (row.transaction_tag ?? []).map((link) => link.tag_id),
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
      sourceSavingsGoalId: decrypted.source_savings_goal_id,
      sourceSavingsGoalName: decrypted.source_savings_goal_name,
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
