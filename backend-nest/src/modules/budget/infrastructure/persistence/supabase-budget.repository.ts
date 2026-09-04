import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { ZodError } from 'zod';
import { BusinessException } from '@common/exceptions/business.exception';
import {
  ERROR_DEFINITIONS,
  type ErrorDefinition,
} from '@common/constants/error-definitions';
import { fetchRowsByParentIds } from '@common/utils/postgrest-pagination';
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
  GenerateBudgetsAtomicallyResult,
} from '../../domain/ports/budget-repository.port';
import { computeTargetMonths } from '../../domain/budget.formulas';
import type { HistoryMonth } from '../../domain/drift-history';
import type {
  MaterializedBudgetPeriod,
  SavingsGoalHorizonPort,
} from '../../domain/ports/savings-goal-horizon.port';
import {
  extractGeneratedBudgetIds,
  validateCreateBudgetResponse,
  validateGenerateBudgetsResponse,
} from '../../schemas/rpc-responses.schema';

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
    const [budgetResult, budgetLines, transactions] = await Promise.all([
      supabase.from('monthly_budget').select('*').eq('id', budgetId).single(),
      this.readPagedRows(
        [budgetId],
        (ids, from, to) =>
          supabase
            .from('budget_line')
            .select('*, budget_line_tag(tag_id)')
            .in('budget_id', ids)
            // `created_at` alone does not order these. Instantiating a budget
            // from a template inserts every line in one statement, so they share
            // a timestamp to the microsecond and Postgres falls back to physical
            // heap order — which an UPDATE moves. Checking a line therefore
            // reshuffled the list around it, and undoing the check did not put
            // the line back where it was. `id` is arbitrary; being stable is the
            // whole job — and paging needs that total order to not skip a row.
            .order('created_at', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          operation: 'fetchBudgetLines',
          entityType: 'budgetLines',
        },
      ),
      this.readPagedRows(
        [budgetId],
        (ids, from, to) =>
          supabase
            .from('transaction')
            .select('*, transaction_tag(tag_id)')
            .in('budget_id', ids)
            .order('transaction_date', { ascending: false })
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          operation: 'fetchTransactions',
          entityType: 'transactions',
        },
      ),
    ]);

    if (budgetResult.error || !budgetResult.data) {
      throw this.budgetReadError(budgetResult.error, budgetId, {
        operation: 'fetchBudget',
        entityId: budgetId,
        entityType: 'budget',
      });
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return {
      budget: this.toEntity(budgetResult.data, dek),
      budgetLines: budgetLines.map((row) =>
        this.toBudgetLineDecrypted(row, dek),
      ),
      transactions: transactions.map((row) =>
        this.toTransactionDecrypted(row, dek),
      ),
    };
  }

  async fetchBudgetDataForRecalc(
    budgetId: string,
  ): Promise<BudgetDataForRecalc> {
    const supabase = this.supabaseProvider.client;
    // Paged like every other read of these two tables: this one persists the
    // balance it computes, so a truncated page would not just display a wrong
    // total, it would write one.
    const [budgetLines, transactions] = await Promise.all([
      this.readPagedRows(
        [budgetId],
        (ids, from, to) =>
          supabase
            .from('budget_line')
            .select('id, kind, amount')
            .in('budget_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          operation: 'fetchBudgetDataForRecalc',
          entityType: 'budgetLines',
        },
      ),
      this.readPagedRows(
        [budgetId],
        (ids, from, to) =>
          supabase
            .from('transaction')
            .select('kind, amount, budget_line_id')
            .in('budget_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          operation: 'fetchBudgetDataForRecalc',
          entityType: 'transactions',
        },
      ),
    ]);

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
      budgetLines: budgetLines.map((row) => ({
        id: row.id,
        kind: row.kind,
        amount: decryptStrict(row.amount),
      })),
      transactions: transactions.map((row) => ({
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

  async generateBudgetsFromTemplateAtomically(input: {
    userId: string;
    templateId: string;
    startMonth: number;
    startYear: number;
    count: number;
  }): Promise<GenerateBudgetsAtomicallyResult> {
    const targetMonths = computeTargetMonths(
      input.startMonth,
      input.startYear,
      input.count,
    );

    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase.rpc(
      'generate_budgets_from_template',
      {
        p_user_id: input.userId,
        p_template_id: input.templateId,
        p_start_month: input.startMonth,
        p_start_year: input.startYear,
        p_count: input.count,
        p_excluded_savings_goal_ids_by_period:
          await this.goalIdsExcludedByPeriod(targetMonths),
      },
    );

    if (error) this.throwAtomicGenerationError(error, input.userId);

    const createdBudgetIds = extractGeneratedBudgetIds(data);
    try {
      const result = validateGenerateBudgetsResponse(data);
      return {
        createdBudgetIds: result.created_budget_ids,
        skippedMonths: result.skipped_months,
      };
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
          { reason: 'Invalid result structure from RPC' },
          {
            operation: 'generateBudgetsFromTemplateAtomically',
            createdBudgetIds,
            validationErrors: err.issues,
          },
          { cause: err },
        );
      }
      throw err;
    }
  }

  async goalIdsExcludedFromPeriod(period: BudgetPeriod): Promise<string[]> {
    const exclusions = await this.goalIdsExcludedByPeriod([period]);
    return exclusions[`${period.month}/${period.year}`] ?? [];
  }

  private throwAtomicGenerationError(error: unknown, userId: string): never {
    throw new BusinessException(
      ERROR_DEFINITIONS.BUDGET_GENERATE_FAILED,
      undefined,
      { operation: 'generateBudgetsFromTemplateAtomically', userId },
      { cause: error },
    );
  }

  private async goalIdsExcludedByPeriod(
    periods: BudgetPeriod[],
  ): Promise<Record<string, string[]>> {
    const goals = await this.fetchGoalHorizons();
    const payDayOfMonth = this.supabaseProvider.user.payDayOfMonth ?? null;
    return Object.fromEntries(
      periods.map((period) => {
        const budgetPeriodIndex = periodIndex(period);
        return [
          `${period.month}/${period.year}`,
          goals
            .filter(
              (goal) =>
                budgetPeriodIndex <
                  this.goalStartPeriodIndex(goal, payDayOfMonth) ||
                (goal.target_date != null &&
                  periodIndex(
                    getBudgetPeriodForDate(
                      parseIsoDateLocal(goal.target_date),
                      payDayOfMonth,
                    ),
                  ) < budgetPeriodIndex),
            )
            .map((goal) => goal.id),
        ];
      }),
    );
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
    // Paged: PostgREST caps an unpaginated reply at `max_rows` and reports nothing,
    // so a single `.in()` over every budget used to hand back a truncated row set —
    // the budgets past the cap then aggregated to zero and the list showed a
    // `remaining` the detail screen contradicted.
    const [budgetLines, transactions] = await Promise.all([
      this.readPagedRows(
        budgetIds,
        (ids, from, to) =>
          supabase
            .from('budget_line')
            .select('id, budget_id, kind, amount')
            .in('budget_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          operation: 'fetchBudgetAggregates',
          entityType: 'budgetLines',
        },
      ),
      this.readPagedRows(
        budgetIds,
        (ids, from, to) =>
          supabase
            .from('transaction')
            .select('budget_id, kind, amount, budget_line_id')
            .in('budget_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          operation: 'fetchBudgetAggregates',
          entityType: 'transactions',
        },
      ),
    ]);

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
    // Paged for the same reason as `fetchBudgetAggregates`: the drift prior reads
    // every previous budget at once, so it crosses PostgREST's row cap first.
    const [budgetLines, transactions] = await Promise.all([
      this.readPagedRows(
        budgetIds,
        (ids, from, to) =>
          supabase
            .from('budget_line')
            .select('id, budget_id, kind, amount, checked_at')
            .in('budget_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
          operation: 'fetchHistoryData',
          entityType: 'budgetLines',
        },
      ),
      this.readPagedRows(
        budgetIds,
        (ids, from, to) =>
          supabase
            .from('transaction')
            .select('budget_id, kind, amount, budget_line_id, transaction_date')
            .in('budget_id', ids)
            .order('id', { ascending: true })
            .range(from, to),
        {
          errorDef: ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
          operation: 'fetchHistoryData',
          entityType: 'transactions',
        },
      ),
    ]);

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

  /**
   * Read every row of a set of parents, paged past PostgREST's `max_rows` cap, and
   * turn a failed page into the caller's business error. Never returns a partial
   * set: aggregating a truncated read is what let a wrong `remaining` reach the
   * budget list unnoticed.
   */
  private readPagedRows<T>(
    parentIds: string[],
    fetchPage: (
      ids: string[],
      from: number,
      to: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>,
    context: {
      errorDef: ErrorDefinition;
      operation: string;
      entityType: string;
    },
  ): Promise<T[]> {
    return fetchRowsByParentIds(parentIds, fetchPage).catch(
      (error: unknown) => {
        throw new BusinessException(
          context.errorDef,
          undefined,
          {
            operation: context.operation,
            entityType: context.entityType,
            userId: this.supabaseProvider.user.id,
          },
          { cause: error },
        );
      },
    );
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
