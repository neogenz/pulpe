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
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { mapCurrencyNonAmountMetadataToDb } from '@common/utils/currency-metadata.mapper';
import type { Transaction } from '@modules/transaction/domain/transaction.entity';
import type { BudgetLineRepositoryPort } from '../../domain/ports/budget-line-repository.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  BudgetLineUpdatePatch,
  BudgetLineInsert,
  BudgetLineRow,
  BudgetLineUpdate,
  SpreadDeleteSource,
  SpreadOccurrence,
  SpreadSourceLine,
  TemplateLine,
  TransactionRow,
} from '../../domain/budget-line.entity';
import type { TemplateLineRow } from '@modules/budget-template/domain/budget-template.entity';
import {
  createBudgetLineSpreadListSchema,
  type CreateBudgetLineSpreadItem,
} from './schemas/rpc-payload.schemas';

@Injectable()
export class SupabaseBudgetLineRepository implements BudgetLineRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAll(): Promise<BudgetLine[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetLines',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async findById(id: string): Promise<BudgetLine> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'getBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(data, dek);
  }

  async validateAccess(id: string, userId: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id, monthly_budget!inner(user_id)')
      .eq('id', id)
      .single();

    const loggingContext = {
      operation: 'validateAccess',
      entityId: id,
      entityType: 'budget_line',
      userId,
      supabaseError: error,
    };

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        loggingContext,
        { cause: error ?? undefined },
      );
    }

    const row = data as BudgetLineRow & {
      monthly_budget: { user_id: string };
    };

    if (row.monthly_budget.user_id !== userId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        { ...loggingContext, reason: 'user_mismatch' },
        { cause: undefined },
      );
    }
  }

  async findByBudgetId(budgetId: string): Promise<BudgetLine[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'listBudgetLinesByBudget',
          entityId: budgetId,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toEntity(row, dek));
  }

  async findBySpreadGroupId(
    spreadGroupId: string,
  ): Promise<SpreadOccurrence[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('*, monthly_budget!inner(month, year, user_id)')
      .eq('spread_group_id', spreadGroupId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'findBudgetLinesBySpreadGroup',
          entityId: spreadGroupId,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const rows = data as Array<
      BudgetLineRow & {
        monthly_budget: { month: number; year: number; user_id: string };
      }
    >;
    const consumedByLine = await this.sumTransactionsByLine(
      rows.map((row) => row.id),
      dek,
    );
    return rows.map((row) => {
      const consumption = consumedByLine.get(row.id);
      return this.toSpreadOccurrence(
        row,
        dek,
        consumption?.consumed ?? 0,
        consumption?.transactionCount ?? 0,
      );
    });
  }

  /**
   * Σ + count of allocated transactions per budget_line, for the spread
   * occurrences read ONLY. Amounts are encrypted → fetch + decrypt + reduce in
   * app (no SQL SUM possible). RLS scopes to the current user; empty list skips
   * the query. Surfaces the réalisé (consommé) per spread occurrence without
   * touching the non-spread consumption paths.
   */
  private async sumTransactionsByLine(
    lineIds: string[],
    dek: Buffer,
  ): Promise<Map<string, { consumed: number; transactionCount: number }>> {
    const byLine = new Map<
      string,
      { consumed: number; transactionCount: number }
    >();
    if (lineIds.length === 0) return byLine;

    const { data, error } = await this.supabaseProvider.client
      .from('transaction')
      .select('*')
      .in('budget_line_id', lineIds);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'sumSpreadOccurrenceTransactions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    for (const row of (data ?? []) as TransactionRow[]) {
      const lineId = row.budget_line_id;
      if (!lineId) continue;
      const { amount } = this.encryption.decryptRowAmountFields(row, dek);
      const prev = byLine.get(lineId) ?? { consumed: 0, transactionCount: 0 };
      byLine.set(lineId, {
        consumed: prev.consumed + amount,
        transactionCount: prev.transactionCount + 1,
      });
    }
    return byLine;
  }

  async findSpreadSource(id: string): Promise<SpreadSourceLine> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('*, monthly_budget!inner(month, year, user_id)')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'findSpreadSource',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    const row = data as BudgetLineRow & {
      monthly_budget: { month: number; year: number; user_id: string };
    };
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      month: row.monthly_budget.month,
      year: row.monthly_budget.year,
      name: decrypted.name,
      amount: decrypted.amount,
      originalAmount: decrypted.original_amount,
      originalCurrency:
        decrypted.original_currency as SpreadSourceLine['originalCurrency'],
      targetCurrency:
        decrypted.target_currency as SpreadSourceLine['targetCurrency'],
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      recurrence: decrypted.recurrence,
      spreadGroupId: decrypted.spread_group_id,
    };
  }

  private toSpreadOccurrence(
    row: BudgetLineRow & { monthly_budget: { month: number; year: number } },
    dek: Buffer,
    consumed: number,
    transactionCount: number,
  ): SpreadOccurrence {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      budgetLineId: decrypted.id,
      budgetId: decrypted.budget_id,
      month: row.monthly_budget.month,
      year: row.monthly_budget.year,
      name: decrypted.name,
      amount: decrypted.amount,
      consumed,
      transactionCount,
      originalAmount: decrypted.original_amount,
      originalCurrency: decrypted.original_currency,
      targetCurrency: decrypted.target_currency,
      exchangeRate: decrypted.exchange_rate,
      kind: decrypted.kind,
      checkedAt: decrypted.checked_at,
    };
  }

  async fetchBudgetIdForLine(id: string): Promise<string | null> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('budget_id')
      .eq('id', id)
      .single();

    if (error) {
      // PGRST116 = "Searched for a single row but found 0 rows"
      if (error.code === 'PGRST116') return null;
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetIdForLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data?.budget_id ?? null;
  }

  async insert(input: BudgetLineCreateInput): Promise<BudgetLine> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const insertRow = await this.toInsertRow(input, user);

    const { data: row, error } = await supabase
      .from('budget_line')
      .insert(insertRow)
      .select()
      .single();

    if (error || !row) {
      const loggingContext = {
        operation: 'createBudgetLine',
        entityType: 'budget_line',
        supabaseError: error,
      };

      if (error?.code === '23505') {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_EXISTS,
          { id: input.id },
          loggingContext,
          { cause: error },
        );
      }

      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        loggingContext,
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(row, dek);
  }

  async createSpread(
    spreadGroupId: string,
    inputs: BudgetLineCreateInput[],
    source?: SpreadDeleteSource,
  ): Promise<BudgetLine[]> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const rpcLines = await Promise.all(
      inputs.map((input) => this.toSpreadRpcLine(input, user)),
    );
    const payload = this.parseSpreadPayload(rpcLines);

    const { data, error } = await supabase.rpc('create_budget_lines_spread', {
      p_spread_group_id: spreadGroupId,
      p_lines: payload as never,
      p_source_budget_line_id:
        source?.type === 'budget_line' ? source.id : undefined,
      p_source_transaction_id:
        source?.type === 'transaction' ? source.id : undefined,
    });

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
        undefined,
        {
          operation: 'createSpreadBudgetLines',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(user);
    return data.map((row) => this.toEntity(row, dek));
  }

  private parseSpreadPayload(
    rpcLines: CreateBudgetLineSpreadItem[],
  ): CreateBudgetLineSpreadItem[] {
    try {
      return createBudgetLineSpreadListSchema.parse(rpcLines);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_CREATE_FAILED,
          { reason: 'Invalid spread RPC payload' },
          {
            operation: 'createSpreadBudgetLines',
            entityType: 'budget_line',
            validationErrors: error.issues,
          },
          { cause: error },
        );
      }
      throw error;
    }
  }

  private async toSpreadRpcLine(
    input: BudgetLineCreateInput,
    user: AuthenticatedUser,
  ): Promise<CreateBudgetLineSpreadItem> {
    const { amount } = await this.encryption.prepareAmountData(
      input.amount,
      user.id,
      user.clientKey,
    );
    const originalAmount = await this.encryption.encryptOptionalAmount(
      input.originalAmount,
      user.id,
      user.clientKey,
    );

    return {
      budget_id: input.budgetId,
      name: input.name,
      amount,
      kind: input.kind,
      recurrence: input.recurrence,
      savings_goal_id: input.savingsGoalId ?? null,
      original_amount: originalAmount,
      original_currency: input.originalCurrency ?? null,
      target_currency: input.targetCurrency ?? null,
      exchange_rate: input.exchangeRate ?? null,
    };
  }

  async update(id: string, patch: BudgetLineUpdatePatch): Promise<BudgetLine> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const updateRow = await this.toUpdateRow(patch, user);

    const { data: row, error } = await supabase
      .from('budget_line')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) {
      const loggingContext = {
        operation: 'updateBudgetLine',
        entityId: id,
        entityType: 'budget_line',
        supabaseError: error,
      };

      // PGRST116 = "Searched for a single row but found 0 rows"
      if (!error || error.code === 'PGRST116') {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
          { id },
          loggingContext,
          { cause: error ?? undefined },
        );
      }

      if (error.code === '23505') {
        throw new BusinessException(
          ERROR_DEFINITIONS.BUDGET_LINE_ALREADY_EXISTS,
          { id },
          loggingContext,
          { cause: error },
        );
      }

      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        undefined,
        loggingContext,
        { cause: error },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(row, dek);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('budget_line').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_DELETE_FAILED,
        { id },
        {
          operation: 'deleteBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }
  }

  async fetchTemplateLineById(templateLineId: string): Promise<TemplateLine> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('template_line')
      .select(
        'name, amount, kind, recurrence, original_amount, original_currency, target_currency, exchange_rate, id, created_at, updated_at, description, template_id',
      )
      .eq('id', templateLineId)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: templateLineId,
      });
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toTemplateLine(data, dek);
  }

  async toggleCheckRpc(id: string): Promise<BudgetLine> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .rpc('toggle_budget_line_check', {
        p_budget_line_id: id,
      })
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        undefined,
        {
          operation: 'toggleCheck',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return this.toEntity(data, dek);
  }

  async checkUncheckedTransactionsRpc(id: string): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase.rpc('check_unchecked_transactions', {
      p_budget_line_id: id,
    });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_UPDATE_FAILED,
        undefined,
        {
          operation: 'checkTransactions',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }

    if (!data?.length) return [];
    const dek = await this.encryption.getDekFor(this.supabaseProvider.user);
    return data.map((row) => this.toTransactionEntity(row, dek));
  }

  private toEntity(row: BudgetLineRow, dek: Buffer): BudgetLine {
    const decrypted = this.encryption.decryptRowAmountFields(row, dek);
    return {
      id: decrypted.id,
      budgetId: decrypted.budget_id,
      templateLineId: decrypted.template_line_id,
      savingsGoalId: decrypted.savings_goal_id,
      spreadGroupId: decrypted.spread_group_id,
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

  private toTemplateLine(row: TemplateLineRow, dek: Buffer): TemplateLine {
    return {
      id: row.id,
      templateId: row.template_id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      originalAmount: row.original_amount
        ? this.encryption.tryDecryptAmount(row.original_amount, dek, null)
        : null,
      originalCurrency:
        row.original_currency as TemplateLine['originalCurrency'],
      targetCurrency: row.target_currency as TemplateLine['targetCurrency'],
      exchangeRate: row.exchange_rate,
      kind: row.kind,
      recurrence: row.recurrence,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTransactionEntity(row: TransactionRow, dek: Buffer): Transaction {
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

  private async toInsertRow(
    input: BudgetLineCreateInput,
    user: AuthenticatedUser,
  ): Promise<BudgetLineInsert> {
    const { amount: encryptedAmount } = await this.encryption.prepareAmountData(
      input.amount,
      user.id,
      user.clientKey,
    );

    const encryptedOriginalAmount = await this.encryption.encryptOptionalAmount(
      input.originalAmount,
      user.id,
      user.clientKey,
    );

    return {
      ...(input.id ? { id: input.id } : {}),
      budget_id: input.budgetId,
      template_line_id: input.templateLineId ?? null,
      savings_goal_id: input.savingsGoalId ?? null,
      name: input.name,
      amount: encryptedAmount,
      original_amount: encryptedOriginalAmount,
      ...mapCurrencyNonAmountMetadataToDb(
        {
          originalCurrency: input.originalCurrency,
          targetCurrency: input.targetCurrency,
          exchangeRate: input.exchangeRate,
        },
        { userId: user.id },
      ),
      kind: input.kind,
      recurrence: input.recurrence,
      is_manually_adjusted: input.isManuallyAdjusted ?? false,
      checked_at: input.checkedAt ?? null,
    };
  }

  private async toUpdateRow(
    patch: BudgetLineUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<BudgetLineUpdate> {
    const updateData: BudgetLineUpdate = this.buildScalarUpdates(patch);

    if (patch.amount !== undefined) {
      const { amount } = await this.encryption.prepareAmountData(
        patch.amount,
        user.id,
        user.clientKey,
      );
      updateData.amount = amount;
    }

    if (patch.originalAmount !== undefined) {
      updateData.original_amount = await this.encryption.encryptOptionalAmount(
        patch.originalAmount,
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

    updateData.updated_at = new Date().toISOString();
    return updateData;
  }

  private buildScalarUpdates(patch: BudgetLineUpdatePatch): BudgetLineUpdate {
    const updateData: BudgetLineUpdate = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.kind !== undefined) updateData.kind = patch.kind;
    if (patch.recurrence !== undefined)
      updateData.recurrence = patch.recurrence;
    if (patch.templateLineId !== undefined) {
      updateData.template_line_id = patch.templateLineId;
    }
    if (patch.savingsGoalId !== undefined) {
      updateData.savings_goal_id = patch.savingsGoalId;
    }
    if (patch.isManuallyAdjusted !== undefined) {
      updateData.is_manually_adjusted = patch.isManuallyAdjusted;
    }
    if (patch.checkedAt !== undefined) {
      updateData.checked_at = patch.checkedAt;
    }
    return updateData;
  }
}
