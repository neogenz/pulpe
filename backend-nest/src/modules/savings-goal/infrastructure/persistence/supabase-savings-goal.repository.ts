import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { PAY_DAY_MAX, PAY_DAY_MIN } from 'pulpe-shared';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { mapCurrencyNonAmountMetadataToDb } from '@common/utils/currency-metadata.mapper';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';
import type { Database } from '../../../../types/database.types';
import type { SavingsGoalRepositoryPort } from '../../domain/ports/savings-goal-repository.port';
import type {
  SavingsGoal,
  SavingsGoalContribution,
  SavingsGoalCreateInput,
  SavingsGoalInsert,
  SavingsGoalLinkedContributions,
  SavingsGoalRow,
  SavingsGoalUpdatePatch,
} from '../../domain/savings-goal.entity';

type TransactionKindEnum = Database['public']['Enums']['transaction_kind'];
type TransactionRow = Database['public']['Tables']['transaction']['Row'];

interface LinkedLineRow {
  id: string;
  amount: string | null;
  kind: TransactionKindEnum;
  checked_at: string | null;
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
    const { data, error } = await supabase
      .from('savings_goal')
      .select('*')
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

  async findLinkedContributions(
    goalId: string,
  ): Promise<SavingsGoalLinkedContributions> {
    const supabase = this.supabaseProvider.client;
    // Double garde kind=saving (le lien est déjà kind-guardé à l'écriture par
    // trigger + use-cases). RLS scope les lignes au user courant.
    const { data, error } = await supabase
      .from('budget_line')
      .select('id, amount, kind, checked_at, monthly_budget!inner(month, year)')
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
    if (!rows.length) return { lines: [], transactions: [] };

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const lines = rows.map((row) => ({
      id: row.id,
      amount: this.encryption.tryDecryptAmount(row.amount, dek, 0),
      kind: row.kind,
      checkedAt: row.checked_at,
      month: row.monthly_budget.month,
      year: row.monthly_budget.year,
    }));

    const transactions = await this.findTransactionsForLines(
      lines.map((line) => line.id),
      dek,
    );
    return { lines, transactions };
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

  async findPayDayOfMonth(): Promise<number | null> {
    const { data } = await this.supabaseProvider.client.auth.getUser();
    const raw: unknown = data?.user?.user_metadata?.payDayOfMonth;
    if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
    return Math.max(PAY_DAY_MIN, Math.min(PAY_DAY_MAX, raw));
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
      .select('*')
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
    for (const row of (data ?? []) as TransactionRow[]) {
      const transaction = this.toTransaction(row, dek);
      const lineId = transaction.budgetLineId;
      if (!lineId) continue;
      const group = byLineId.get(lineId);
      if (group) group.push(transaction);
      else byLineId.set(lineId, [transaction]);
    }
    return byLineId;
  }

  private toTransaction(row: TransactionRow, dek: Buffer): Transaction {
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

  private toEntity(row: SavingsGoalRow, dek: Buffer): SavingsGoal {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      targetAmount: row.target_amount
        ? this.encryption.tryDecryptAmount(row.target_amount, dek, 0)
        : 0,
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
    };
  }

  private async toInsertRow(
    input: SavingsGoalCreateInput,
    user: AuthenticatedUser,
  ): Promise<SavingsGoalInsert> {
    const dek = await this.encryption.getDekFor(user);
    const targetAmount = this.encryption.encryptAmount(input.targetAmount, dek);
    const originalTargetAmount = await this.encryption.encryptOptionalAmount(
      input.originalTargetAmount,
      user.id,
      user.clientKey,
    );

    return {
      user_id: user.id,
      name: input.name,
      target_amount: targetAmount,
      original_target_amount: originalTargetAmount,
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
    if (patch.targetDate !== undefined)
      updateData.target_date = patch.targetDate;
    if (patch.status !== undefined) updateData.status = patch.status;

    if (patch.targetAmount !== undefined) {
      const dek = await this.encryption.getDekFor(user);
      updateData.target_amount = this.encryption.encryptAmount(
        patch.targetAmount,
        dek,
      );
    }

    if (patch.originalTargetAmount !== undefined) {
      updateData.original_target_amount =
        await this.encryption.encryptOptionalAmount(
          patch.originalTargetAmount,
          user.id,
          user.clientKey,
        );
    }

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

    return updateData;
  }
}
