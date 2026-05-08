import { Inject, Injectable } from '@nestjs/common';
import type { Buffer } from 'node:buffer';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import { AuthenticatedSupabaseProvider } from '@modules/supabase/authenticated-supabase.provider';
import {
  ENCRYPTION_PORT,
  type EncryptionPort,
} from '@modules/encryption/encryption.tokens';
import type { AuthenticatedUser } from '@common/decorators/user.decorator';
import { mapCurrencyMetadataToDb } from '@common/utils/currency-metadata.mapper';
import type { BudgetLineRepositoryPort } from '../../domain/ports/budget-line-repository.port';
import type {
  BudgetLine,
  BudgetLineCreateInput,
  BudgetLineUpdatePatch,
  BudgetLineInsert,
  BudgetLineRow,
  BudgetLineUpdate,
  TemplateLineEntity,
  TemplateLineRow,
  TransactionEntity,
  TransactionRow,
} from '../../domain/budget-line.entity';

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
    const dek = await this.getDek();
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

    const dek = await this.getDek();
    return this.toEntity(data, dek);
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
    const dek = await this.getDek();
    return data.map((row) => this.toEntity(row, dek));
  }

  async fetchBudgetIdForLine(id: string): Promise<string | null> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('budget_line')
      .select('budget_id')
      .eq('id', id)
      .single();

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

    const dek = await this.getDek();
    return this.toEntity(row, dek);
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
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'updateBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error ?? undefined },
      );
    }

    const dek = await this.getDek();
    return this.toEntity(row, dek);
  }

  async delete(id: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { error } = await supabase.from('budget_line').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id },
        {
          operation: 'deleteBudgetLine',
          entityId: id,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }
  }

  async fetchTemplateLineById(
    templateLineId: string,
  ): Promise<TemplateLineEntity> {
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

    const dek = await this.getDek();
    return this.toTemplateLineEntity(data, dek);
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

    const dek = await this.getDek();
    return this.toEntity(data, dek);
  }

  async checkUncheckedTransactionsRpc(
    id: string,
  ): Promise<TransactionEntity[]> {
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
    const dek = await this.getDek();
    return data.map((row) => this.toTransactionEntity(row, dek));
  }

  private async getDek(): Promise<Buffer> {
    const user = this.supabaseProvider.user;
    return this.encryption.getUserDEK(user.id, user.clientKey);
  }

  private toEntity(row: BudgetLineRow, dek: Buffer): BudgetLine {
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

  private toTemplateLineEntity(
    row: TemplateLineRow,
    dek: Buffer,
  ): TemplateLineEntity {
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
      originalCurrency: row.original_currency,
      targetCurrency: row.target_currency,
      exchangeRate: row.exchange_rate,
      kind: row.kind,
      recurrence: row.recurrence,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toTransactionEntity(
    row: TransactionRow,
    dek: Buffer,
  ): TransactionEntity {
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
      ...mapCurrencyMetadataToDb({
        originalCurrency: input.originalCurrency,
        targetCurrency: input.targetCurrency,
        exchangeRate: input.exchangeRate,
      }),
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
      mapCurrencyMetadataToDb({
        originalCurrency: patch.originalCurrency,
        targetCurrency: patch.targetCurrency,
        exchangeRate: patch.exchangeRate,
      }),
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
