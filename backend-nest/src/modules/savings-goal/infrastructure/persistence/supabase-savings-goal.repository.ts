import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import type { PostgrestError } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import {
  savingsGoalDeletionImpactSchema,
  type BudgetLine,
  type BudgetPeriod,
  type LinkedSavingLine,
  type SavingsGoalDeletionCommand,
  type SavingsGoalGenerationStop,
} from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { isSavingsGoalLinkDenied } from '@common/utils/savings-goal-link';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import {
  mapCurrencyNonAmountMetadataToDb,
  parseCurrency,
} from '@common/utils/currency-metadata.mapper';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';
import type { Database } from '../../../../types/database.types';
import type { SavingsGoalRepositoryPort } from '../../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalContribution,
  SavingsGoalCreateInput,
  SavingsGoalDeletionImpactResult,
  SavingsGoalDeletionResult,
  SavingsGoalGenerationStopResult,
  SavingsGoalInsert,
  SavingsGoalLinkedContributions,
  SavingsGoalPlanApplyResult,
  SavingsGoalPlanMonthAdjustment,
  SavingsGoalRow,
  SavingsGoalTargetDateReconciliationCommand,
  SavingsGoalTargetDateReconciliationResult,
  SavingsGoalUpdatePatch,
} from '../../domain/savings-goal.entity';
import {
  applySavingsGoalPlanLineListSchema,
  GENERATION_STOP_ADJUSTED_RPC_MESSAGE,
  GENERATION_STOP_CHECKED_RPC_MESSAGE,
  GENERATION_STOP_NOT_LINKED_RPC_MESSAGE,
  GENERATION_STOP_PAST_RPC_MESSAGE,
  PLAN_LINE_CHECKED_RPC_MESSAGE,
  PLAN_LINE_NOT_LINKED_RPC_MESSAGE,
  PLAN_LINE_PAST_RPC_MESSAGE,
  RECONCILIATION_CONFLICT_RPC_MESSAGE,
  reconcileSavingsGoalTargetDatePatchSchema,
  reconcileSavingsGoalTargetDateResponseSchema,
  savingsGoalDeletionImpactRpcSchema,
  savingsGoalDeletionResultRpcSchema,
  SAVINGS_GOAL_DELETION_IMPACT_CHANGED_RPC_MESSAGE,
  type ApplySavingsGoalPlanLine,
  type SavingsGoalDeletionImpactRpc,
} from './schemas/rpc-payload.schemas';

type TransactionKindEnum = Database['public']['Enums']['transaction_kind'];
type TransactionRow = Database['public']['Tables']['transaction']['Row'];
type TransactionRowWithTags = TransactionRow & {
  transaction_tag?: { tag_id: string }[];
};
type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];

interface LinkedLineRow {
  id: string;
  amount: string | null;
  kind: TransactionKindEnum;
  checked_at: string | null;
  is_manually_adjusted: boolean;
  monthly_budget: { month: number; year: number };
}

interface LinkedTransactionRow {
  budget_line_id: string | null;
  amount: string | null;
  kind: TransactionKindEnum;
  checked_at: string | null;
}

interface ContributionLineRow {
  id: string;
  name: string;
  amount: string | null;
  checked_at: string | null;
  monthly_budget: { month: number; year: number };
}

@Injectable()
export class SupabaseSavingsGoalRepository implements SavingsGoalRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAll(): Promise<SavingsGoal[]> {
    const supabase = this.supabaseProvider.client;
    // RLS already isolates, but the explicit filter hands the planner the
    // savings_goal(user_id) index (project Supabase rule).
    const { data, error } = await supabase
      .from('savings_goal')
      .select('*')
      .eq('user_id', this.supabaseProvider.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        undefined,
        {
          operation: 'listSavingsGoals',
          entityType: 'savings_goal',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async findById(id: string): Promise<SavingsGoal> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('savings_goal')
      .select('*')
      .eq('id', id)
      .eq('user_id', this.supabaseProvider.user.id)
      .single();

    if (error || !data) {
      throw this.savingsGoalReadError(error, id, {
        operation: 'getSavingsGoal',
        entityId: id,
        entityType: 'savings_goal',
      });
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(data, dek);
  }

  /**
   * PostgREST returns code `PGRST116` when a `.single()` matched zero rows — a
   * genuine 404 (missing or RLS-hidden). Any other error (statement timeout,
   * PostgREST saturation) is an infra failure and must surface as 500, never a
   * lying "Savings goal not found". Mirrors budgetReadError.
   */
  private savingsGoalReadError(
    error: { code?: string } | null | undefined,
    id: string,
    loggingContext: Record<string, unknown>,
  ): BusinessException {
    if (error && error.code !== 'PGRST116') {
      return new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        undefined,
        loggingContext,
        { cause: error },
      );
    }
    return new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
      { id },
      loggingContext,
    );
  }

  async insert(input: SavingsGoalCreateInput): Promise<SavingsGoal> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const row = await this.toInsertRow(input, user);

    const { data, error } = await supabase
      .from('savings_goal')
      .insert(row)
      .select('*')
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_CREATE_FAILED,
        undefined,
        {
          operation: 'createSavingsGoal',
          entityType: 'savings_goal',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(user);
    return this.toEntity(data, dek);
  }

  async update(
    id: string,
    patch: SavingsGoalUpdatePatch,
  ): Promise<SavingsGoal> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;
    const updateRow = await this.toUpdateRow(patch, user);

    const { data, error } = await supabase
      .from('savings_goal')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    // PGRST116 = zero rows matched → the NOT_FOUND branch below, not a 500.
    if (error && error.code !== 'PGRST116') {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_UPDATE_FAILED,
        { id },
        {
          operation: 'updateSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          userId: user.id,
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        { id },
        {
          operation: 'updateSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          userId: user.id,
        },
      );
    }

    const dek = await this.encryption.getDekFor(user);
    return this.toEntity(data, dek);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    // FK budget_line/template_line.savings_goal_id ON DELETE SET NULL unlinks
    // the tagged lines atomically — no line is ever deleted.
    const { error } = await supabase.from('savings_goal').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_DELETE_FAILED,
        { id },
        {
          operation: 'deleteSavingsGoal',
          entityId: id,
          entityType: 'savings_goal',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  async getDeletionImpact(
    goalId: string,
  ): Promise<SavingsGoalDeletionImpactResult> {
    const { data, error } = await this.supabaseProvider.client.rpc(
      'get_savings_goal_deletion_impact',
      { p_goal_id: goalId },
    );

    if (error || !data) {
      throw this.deletionImpactReadError(error, goalId);
    }

    try {
      const raw = savingsGoalDeletionImpactRpcSchema.parse(data);
      return await this.toDeletionImpact(raw);
    } catch (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        { id: goalId },
        {
          operation: 'getSavingsGoalDeletionImpact',
          entityId: goalId,
          entityType: 'savings_goal',
          userId: this.supabaseProvider.user.id,
          validationErrors:
            error instanceof ZodError ? error.issues : undefined,
        },
        { cause: error },
      );
    }
  }

  async applyDeletion(
    goalId: string,
    command: SavingsGoalDeletionCommand,
  ): Promise<SavingsGoalDeletionResult> {
    const { data, error } = await this.supabaseProvider.client.rpc(
      'apply_savings_goal_deletion',
      {
        p_goal_id: goalId,
        p_mode: command.mode,
        p_revision: command.revision,
      },
    );

    if (error || !data) this.throwDeletionRpcError(error);

    try {
      const rows = savingsGoalDeletionResultRpcSchema.parse(data);
      return {
        touchedBudgetIds: [...new Set(rows.map((row) => row.budget_id))],
      };
    } catch (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_DELETE_FAILED,
        { id: goalId },
        {
          operation: 'applySavingsGoalDeletion',
          entityId: goalId,
          entityType: 'savings_goal',
          userId: this.supabaseProvider.user.id,
          validationErrors:
            error instanceof ZodError ? error.issues : undefined,
        },
        { cause: error },
      );
    }
  }

  async findLinkedContributions(
    goalId: string,
  ): Promise<SavingsGoalLinkedContributions> {
    const lines = await this.findLinkedSavingLines(goalId);
    if (!lines.length) return { lines: [], transactions: [] };

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const transactions = await this.findTransactionsForLines(
      lines.map((line) => line.id),
      dek,
    );
    return { lines, transactions };
  }

  async findLinkedSavingLines(goalId: string): Promise<LinkedSavingLine[]> {
    const supabase = this.supabaseProvider.client;
    // Double garde kind=saving (le lien est déjà kind-guardé à l'écriture par
    // trigger + use-cases). RLS scope les lignes au user courant.
    const { data, error } = await supabase
      .from('budget_line')
      .select(
        'id, amount, kind, checked_at, is_manually_adjusted, monthly_budget!inner(month, year)',
      )
      .eq('savings_goal_id', goalId)
      .eq('kind', 'saving');

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        undefined,
        {
          operation: 'findSavingsGoalLinkedContributions',
          entityId: goalId,
          entityType: 'savings_goal',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    const rows = (data ?? []) as unknown as LinkedLineRow[];
    if (!rows.length) return [];

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return rows.map((row) => ({
      id: row.id,
      amount: this.encryption.tryDecryptAmount(row.amount, dek, 0),
      kind: row.kind,
      checkedAt: row.checked_at,
      isManuallyAdjusted: row.is_manually_adjusted,
      month: row.monthly_budget.month,
      year: row.monthly_budget.year,
    }));
  }

  async findContributions(goalId: string): Promise<SavingsGoalContribution[]> {
    const lineRows = await this.findSavingLines(goalId);
    if (!lineRows.length) return [];

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const transactionsByLineId = await this.findTransactionsByLine(
      lineRows.map((row) => row.id),
      dek,
    );

    return lineRows
      .map((row) => ({
        lineId: row.id,
        name: row.name,
        amount: this.encryption.tryDecryptAmount(row.amount, dek, 0),
        checkedAt: row.checked_at,
        budgetMonth: row.monthly_budget.month,
        budgetYear: row.monthly_budget.year,
        transactions: transactionsByLineId.get(row.id) ?? [],
      }))
      .sort(
        (a, b) => a.budgetYear - b.budgetYear || a.budgetMonth - b.budgetMonth,
      );
  }

  async findMaterializedPeriods(): Promise<BudgetPeriod[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('monthly_budget')
      .select('month, year')
      .eq('user_id', this.supabaseProvider.user.id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        undefined,
        {
          operation: 'findSavingsGoalMaterializedPeriods',
          entityType: 'monthly_budget',
          userId: this.supabaseProvider.user.id,
        },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async applyPlan(
    goalId: string,
    monthAdjustments: SavingsGoalPlanMonthAdjustment[],
    minPeriodIndex: number,
  ): Promise<SavingsGoalPlanApplyResult> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const lineUpdates = await Promise.all(
      monthAdjustments.map((adjustment) =>
        this.toPlanRpcLine(adjustment, user),
      ),
    );
    const linePayload = this.parsePlanPayload(lineUpdates);

    const { data, error } = await supabase.rpc('apply_savings_goal_plan', {
      p_goal_id: goalId,
      p_min_period_index: minPeriodIndex,
      p_line_updates: linePayload as never,
    });

    if (error || !data) {
      this.throwPlanRpcError(error);
    }

    const dek = await this.encryption.getDekFor(user);
    const updatedLines = data.map((row) => this.toBudgetLineEntity(row, dek));
    const touchedBudgetIds = [
      ...new Set(updatedLines.map((line) => line.budgetId)),
    ];
    return { updatedLines, touchedBudgetIds };
  }

  async applyGenerationStop(
    goalId: string,
    mode: SavingsGoalGenerationStop['mode'],
    budgetLineIds: string[],
    minPeriodIndex: number,
  ): Promise<SavingsGoalGenerationStopResult> {
    const { data, error } = await this.supabaseProvider.client.rpc(
      'apply_savings_goal_generation_stop',
      {
        p_goal_id: goalId,
        p_mode: mode,
        p_budget_line_ids: budgetLineIds,
        p_min_period_index: minPeriodIndex,
      },
    );

    if (error || !data) {
      this.throwGenerationStopRpcError(error);
    }

    return {
      affectedLineIds: data.map((row) => row.line_id),
      touchedBudgetIds: [...new Set(data.map((row) => row.budget_id))],
    };
  }

  async reconcileTargetDate(
    goalId: string,
    command: SavingsGoalTargetDateReconciliationCommand,
  ): Promise<SavingsGoalTargetDateReconciliationResult> {
    const user = this.supabaseProvider.user;
    const encryptedPatch = await this.toUpdateRow(command.patch, user);
    let patchPayload: ReturnType<
      typeof reconcileSavingsGoalTargetDatePatchSchema.parse
    >;
    try {
      patchPayload =
        reconcileSavingsGoalTargetDatePatchSchema.parse(encryptedPatch);
    } catch (cause) {
      if (cause instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.SAVINGS_GOAL_RECONCILIATION_FAILED,
          undefined,
          {
            operation: 'reconcileSavingsGoalTargetDate.payload',
            validationErrors: cause.issues,
          },
          { cause },
        );
      }
      throw cause;
    }

    const { data, error } = await this.supabaseProvider.client.rpc(
      'reconcile_savings_goal_target_date',
      {
        p_goal_id: goalId,
        p_mode: command.reconciliation.mode,
        p_budget_line_ids: command.reconciliation.budgetLineIds,
        p_expected_target_date: command.expectedTargetDate,
        p_patch: patchPayload,
      },
    );
    if (error || !data) {
      this.throwTargetDateReconciliationRpcError(error);
    }

    try {
      const parsed = reconcileSavingsGoalTargetDateResponseSchema.parse(data);
      const dek = await this.encryption.getDekFor(user);
      return {
        goal: this.toEntity(parsed.goal as unknown as SavingsGoalRow, dek),
        affectedLineIds: parsed.affected_line_ids,
        touchedBudgetIds: parsed.touched_budget_ids,
      };
    } catch (cause) {
      if (cause instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.SAVINGS_GOAL_RECONCILIATION_FAILED,
          undefined,
          {
            operation: 'reconcileSavingsGoalTargetDate.response',
            validationErrors: cause.issues,
          },
          { cause },
        );
      }
      throw cause;
    }
  }

  private throwTargetDateReconciliationRpcError(
    error: PostgrestError | null,
  ): never {
    if (isSavingsGoalLinkDenied(error)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        undefined,
        {
          operation: 'reconcileSavingsGoalTargetDate',
          entityType: 'savings_goal',
        },
        { cause: error ?? undefined },
      );
    }
    if ((error?.message ?? '').includes(RECONCILIATION_CONFLICT_RPC_MESSAGE)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_RECONCILIATION_CONFLICT,
        undefined,
        {
          operation: 'reconcileSavingsGoalTargetDate',
          entityType: 'savings_goal',
        },
        { cause: error ?? undefined },
      );
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_RECONCILIATION_FAILED,
      undefined,
      {
        operation: 'reconcileSavingsGoalTargetDate',
        entityType: 'savings_goal',
      },
      { cause: error ?? undefined },
    );
  }

  /**
   * Maps an `apply_savings_goal_generation_stop` RPC failure to the right
   * business error (same idiom as `throwPlanRpcError`):
   * - ownership → SAVINGS_GOAL_NOT_FOUND (404, RLS-hiding idiom);
   * - checked / adjusted / past-period → 409 (candidates drifted — refetch);
   * - not-linked → 422 (refetch the candidate list);
   * - anything else → generic failure (500) : la RPC a tout rollback, un
   *   retry complet ré-applique proprement. (La sémantique retry APRÈS commit
   *   — 422 inoffensif — est documentée sur `recalculateAfterCommit` côté
   *   use-case, pas ici.)
   */
  private throwGenerationStopRpcError(error: PostgrestError | null): never {
    if (isSavingsGoalLinkDenied(error)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        undefined,
        {
          operation: 'applySavingsGoalGenerationStop',
          entityType: 'savings_goal',
        },
        { cause: error ?? undefined },
      );
    }
    const message = error?.message ?? '';
    if (
      message.includes(GENERATION_STOP_CHECKED_RPC_MESSAGE) ||
      message.includes(GENERATION_STOP_ADJUSTED_RPC_MESSAGE) ||
      message.includes(GENERATION_STOP_PAST_RPC_MESSAGE)
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_GENERATION_STOP_CONFLICT,
        undefined,
        {
          operation: 'applySavingsGoalGenerationStop',
          entityType: 'savings_goal',
        },
        { cause: error ?? undefined },
      );
    }
    if (message.includes(GENERATION_STOP_NOT_LINKED_RPC_MESSAGE)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_GENERATION_STOP_LINE_INVALID,
        undefined,
        {
          operation: 'applySavingsGoalGenerationStop',
          entityType: 'savings_goal',
        },
        { cause: error ?? undefined },
      );
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_GENERATION_STOP_FAILED,
      undefined,
      {
        operation: 'applySavingsGoalGenerationStop',
        entityType: 'savings_goal',
        supabaseError: error,
      },
      { cause: error ?? undefined },
    );
  }

  private throwDeletionRpcError(error: PostgrestError | null): never {
    if (isSavingsGoalLinkDenied(error)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        undefined,
        {
          operation: 'applySavingsGoalDeletion',
          entityType: 'savings_goal',
          userId: this.supabaseProvider.user.id,
        },
        { cause: error ?? undefined },
      );
    }
    if (
      (error?.message ?? '').includes(
        SAVINGS_GOAL_DELETION_IMPACT_CHANGED_RPC_MESSAGE,
      )
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.CONCURRENT_MODIFICATION,
        { resource: 'savings_goal_deletion_impact' },
        {
          operation: 'applySavingsGoalDeletion',
          entityType: 'savings_goal',
          userId: this.supabaseProvider.user.id,
        },
        { cause: error ?? undefined },
      );
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_DELETE_FAILED,
      undefined,
      {
        operation: 'applySavingsGoalDeletion',
        entityType: 'savings_goal',
        userId: this.supabaseProvider.user.id,
      },
      { cause: error ?? undefined },
    );
  }

  private deletionImpactReadError(
    error: PostgrestError | null,
    goalId: string,
  ): BusinessException {
    const definition = isSavingsGoalLinkDenied(error)
      ? ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND
      : ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED;
    return new BusinessException(
      definition,
      { id: goalId },
      {
        operation: 'getSavingsGoalDeletionImpact',
        entityId: goalId,
        entityType: 'savings_goal',
        userId: this.supabaseProvider.user.id,
      },
      { cause: error ?? undefined },
    );
  }

  private async toPlanRpcLine(
    adjustment: SavingsGoalPlanMonthAdjustment,
    user: AuthenticatedUser,
  ): Promise<ApplySavingsGoalPlanLine> {
    const { amount } = await this.encryption.prepareAmountData(
      adjustment.amount,
      user.id,
      user.clientKey,
    );
    return { budget_line_id: adjustment.budgetLineId, amount };
  }

  private parsePlanPayload(
    lineUpdates: ApplySavingsGoalPlanLine[],
  ): ApplySavingsGoalPlanLine[] {
    try {
      return applySavingsGoalPlanLineListSchema.parse(lineUpdates);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_APPLY_FAILED,
          undefined,
          {
            operation: 'applySavingsGoalPlan',
            entityType: 'savings_goal',
            validationErrors: error.issues,
          },
          { cause: error },
        );
      }
      throw error;
    }
  }

  /**
   * Maps an `apply_savings_goal_plan` RPC failure to the right business error.
   * Each branch matches an exact P0001 message the RPC RAISEs (named via a
   * constant in rpc-payload.schemas so the SQL↔TS coupling is greppable):
   * - ownership → SAVINGS_GOAL_NOT_FOUND (404, RLS-hiding idiom);
   * - checked / past-period → 409 conflict (the plan drifted mid-simulation);
   * - not-linked → 422 (refetch + resimulate);
   * - anything else → generic apply failure (500, safe to retry — idempotent).
   */
  private throwPlanRpcError(error: PostgrestError | null): never {
    if (isSavingsGoalLinkDenied(error)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_NOT_FOUND,
        undefined,
        { operation: 'applySavingsGoalPlan', entityType: 'savings_goal' },
        { cause: error ?? undefined },
      );
    }
    const message = error?.message ?? '';
    if (
      message.includes(PLAN_LINE_CHECKED_RPC_MESSAGE) ||
      message.includes(PLAN_LINE_PAST_RPC_MESSAGE)
    ) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_CONFLICT,
        undefined,
        { operation: 'applySavingsGoalPlan', entityType: 'savings_goal' },
        { cause: error ?? undefined },
      );
    }
    if (message.includes(PLAN_LINE_NOT_LINKED_RPC_MESSAGE)) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_LINE_INVALID,
        undefined,
        { operation: 'applySavingsGoalPlan', entityType: 'savings_goal' },
        { cause: error ?? undefined },
      );
    }
    throw new BusinessException(
      ERROR_DEFINITIONS.SAVINGS_GOAL_PLAN_APPLY_FAILED,
      undefined,
      {
        operation: 'applySavingsGoalPlan',
        entityType: 'savings_goal',
        supabaseError: error,
      },
      { cause: error ?? undefined },
    );
  }

  private toBudgetLineEntity(row: BudgetLineRow, dek: Buffer): BudgetLine {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      templateLineId: decrypted.template_line_id,
      savingsGoalId: decrypted.savings_goal_id,
      spreadGroupId: decrypted.spread_group_id,
      savingsWithdrawalGroupId: decrypted.savings_withdrawal_group_id,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency: parseCurrency(decrypted.original_currency) ?? null,
      targetCurrency: parseCurrency(decrypted.target_currency) ?? null,
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      recurrence: decrypted.recurrence,
      isManuallyAdjusted: decrypted.is_manually_adjusted,
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
    };
  }

  /**
   * Transactions allouées aux prévisions liées. Montants chiffrés → décryptage
   * applicatif (pas de SUM SQL possible). Les transactions libres n'entrent
   * jamais ici (jointure par budget_line_id).
   */
  private async findTransactionsForLines(
    lineIds: string[],
    dek: Buffer,
  ): Promise<SavingsGoalLinkedContributions['transactions']> {
    const { data, error } = await this.supabaseProvider.client
      .from('transaction')
      .select('budget_line_id, amount, kind, checked_at')
      .in('budget_line_id', lineIds);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'findSavingsGoalLinkedTransactions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return ((data ?? []) as LinkedTransactionRow[]).map((row) => ({
      budgetLineId: row.budget_line_id,
      amount: this.encryption.tryDecryptAmount(row.amount, dek, 0),
      kind: row.kind,
      checkedAt: row.checked_at,
    }));
  }

  /**
   * Prévisions Épargne liées au goal (kind=saving, RLS-scopé) avec leur nom,
   * montant chiffré, statut de pointage et la période de leur budget parent.
   * Base de chaque contribution (PUL-12).
   */
  private async findSavingLines(
    goalId: string,
  ): Promise<ContributionLineRow[]> {
    const { data, error } = await this.supabaseProvider.client
      .from('budget_line')
      .select('id, name, amount, checked_at, monthly_budget!inner(month, year)')
      .eq('savings_goal_id', goalId)
      .eq('kind', 'saving');

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.SAVINGS_GOAL_FETCH_FAILED,
        undefined,
        {
          operation: 'findSavingsGoalContributions',
          entityId: goalId,
          entityType: 'savings_goal',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as unknown as ContributionLineRow[];
  }

  /**
   * Transactions allouées aux lignes fournies, déchiffrées, triées par date
   * décroissante et regroupées par id de ligne parente (PUL-12).
   */
  private async findTransactionsByLine(
    lineIds: string[],
    dek: Buffer,
  ): Promise<Map<string, Transaction[]>> {
    const { data, error } = await this.supabaseProvider.client
      .from('transaction')
      .select('*, transaction_tag(tag_id)')
      .in('budget_line_id', lineIds)
      .order('transaction_date', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'findSavingsGoalContributions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    const byLineId = new Map<string, Transaction[]>();
    for (const row of (data ?? []) as TransactionRowWithTags[]) {
      const transaction = this.toTransaction(row, dek);
      const lineId = transaction.budgetLineId;
      if (!lineId) continue;
      const group = byLineId.get(lineId);
      if (group) group.push(transaction);
      else byLineId.set(lineId, [transaction]);
    }
    return byLineId;
  }

  private toTransaction(row: TransactionRowWithTags, dek: Buffer): Transaction {
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
      tagIds: (row.transaction_tag ?? []).map((link) => link.tag_id),
      transactionDate: decrypted.transaction_date,
      checkedAt: decrypted.checked_at,
      createdAt: decrypted.created_at,
      updatedAt: decrypted.updated_at,
    };
  }

  private async toDeletionImpact(
    raw: SavingsGoalDeletionImpactRpc,
  ): Promise<SavingsGoalDeletionImpactResult> {
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const templateLines = raw.templateLines.map((line) => ({
      ...line,
      amount: this.encryption.tryDecryptAmount(line.amount, dek, 0),
    }));
    const budgets = raw.budgets.map((budget) => ({
      ...budget,
      lines: budget.lines.map((line) => ({
        ...line,
        amount: this.encryption.tryDecryptAmount(line.amount, dek, 0),
        transactions: line.transactions.map((transaction) =>
          this.toDeletionTransaction(transaction, dek),
        ),
      })),
    }));
    const budgetLines = budgets.flatMap((budget) => budget.lines);
    const transactions = budgetLines.flatMap((line) => line.transactions);

    return savingsGoalDeletionImpactSchema.parse({
      goalId: raw.goalId,
      summary: {
        templateLineCount: templateLines.length,
        templateLineTotal: templateLines.reduce(
          (total, line) => total + line.amount,
          0,
        ),
        budgetCount: budgets.length,
        budgetLineCount: budgetLines.length,
        budgetLineTotal: budgetLines.reduce(
          (total, line) => total + line.amount,
          0,
        ),
        transactionCount: transactions.length,
        transactionTotal: transactions.reduce(
          (total, transaction) => total + transaction.amount,
          0,
        ),
      },
      templateLines,
      budgets,
      revision: raw.revision,
    });
  }

  private toDeletionTransaction(
    transaction: SavingsGoalDeletionImpactRpc['budgets'][number]['lines'][number]['transactions'][number],
    dek: Buffer,
  ): Transaction {
    return {
      ...transaction,
      amount: this.encryption.tryDecryptAmount(transaction.amount, dek, 0),
      originalAmount: transaction.originalAmount
        ? this.encryption.tryDecryptAmount(
            transaction.originalAmount,
            dek,
            null,
          )
        : null,
      originalCurrency: parseCurrency(transaction.originalCurrency) ?? null,
      targetCurrency: parseCurrency(transaction.targetCurrency) ?? null,
      tagIds: [],
    };
  }

  private toEntity(row: SavingsGoalRow, dek: Buffer): SavingsGoal {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      startDate: row.start_date,
      targetAmount: row.target_amount
        ? this.encryption.tryDecryptAmount(row.target_amount, dek, 0)
        : null,
      targetDate: row.target_date,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      originalTargetAmount: row.original_target_amount
        ? this.encryption.tryDecryptAmount(
            row.original_target_amount,
            dek,
            null,
          )
        : null,
      originalCurrency: row.original_currency,
      targetCurrency: row.target_currency,
      exchangeRate: row.exchange_rate,
      initialAmount: row.initial_amount
        ? this.encryption.tryDecryptAmount(row.initial_amount, dek, null)
        : null,
    };
  }

  private async toInsertRow(
    input: SavingsGoalCreateInput,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalInsert> {
    const targetAmount = await this.encryption.encryptOptionalAmount(
      input.targetAmount,
      user.id,
      user.clientKey,
    );
    const originalTargetAmount = await this.encryption.encryptOptionalAmount(
      input.originalTargetAmount,
      user.id,
      user.clientKey,
    );
    const initialAmount = await this.encryption.encryptOptionalAmount(
      input.initialAmount,
      user.id,
      user.clientKey,
    );

    return {
      user_id: user.id,
      name: input.name,
      start_date: input.startDate,
      target_amount: targetAmount,
      original_target_amount: originalTargetAmount,
      initial_amount: initialAmount,
      target_date: input.targetDate,
      status: input.status,
      ...mapCurrencyNonAmountMetadataToDb(
        {
          originalCurrency: input.originalCurrency,
          targetCurrency: input.targetCurrency,
          exchangeRate: input.exchangeRate,
        },
        { userId: user.id },
      ),
    };
  }

  private async toUpdateRow(
    patch: SavingsGoalUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<Partial<SavingsGoalInsert>> {
    const updateData: Partial<SavingsGoalInsert> = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.startDate !== undefined) updateData.start_date = patch.startDate;
    if (patch.targetDate !== undefined)
      updateData.target_date = patch.targetDate;
    if (patch.status !== undefined) updateData.status = patch.status;

    if (patch.targetAmount !== undefined) {
      if (patch.targetAmount == null) {
        updateData.target_amount = null;
      } else {
        const dek = await this.encryption.getDekFor(user);
        updateData.target_amount = this.encryption.encryptAmount(
          patch.targetAmount,
          dek,
        );
      }
    }

    if (
      patch.targetAmount !== null &&
      patch.originalTargetAmount !== undefined
    ) {
      updateData.original_target_amount =
        await this.encryption.encryptOptionalAmount(
          patch.originalTargetAmount,
          user.id,
          user.clientKey,
        );
    }

    if (patch.initialAmount !== undefined) {
      updateData.initial_amount = await this.encryption.encryptOptionalAmount(
        patch.initialAmount,
        user.id,
        user.clientKey,
      );
    }

    if (patch.targetAmount === null) {
      Object.assign(updateData, {
        original_target_amount: null,
        original_currency: null,
        target_currency: null,
        exchange_rate: null,
      });
    } else {
      Object.assign(
        updateData,
        mapCurrencyNonAmountMetadataToDb(
          {
            originalCurrency: patch.originalCurrency,
            targetCurrency: patch.targetCurrency,
            exchangeRate: patch.exchangeRate,
          },
          { userId: user.id },
        ),
      );
    }

    return updateData;
  }
}
