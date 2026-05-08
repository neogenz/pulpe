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
import type { TransactionRepositoryPort } from '../../domain/ports/transaction-repository.port';
import type {
  Transaction,
  TransactionCreateInput,
  TransactionUpdatePatch,
  TransactionInsert,
  TransactionRow,
  TransactionUpdate,
  BudgetLineForAllocation,
  TransactionSearchTransactionRow,
  TransactionSearchBudgetLineRow,
} from '../../domain/transaction.entity';
import type { Database } from '../../../../types/database.types';

type TransactionKind = Database['public']['Enums']['transaction_kind'];

@Injectable()
export class SupabaseTransactionRepository implements TransactionRepositoryPort {
  constructor(
    private readonly supabaseProvider: AuthenticatedSupabaseProvider,
    @Inject(ENCRYPTION_PORT) private readonly encryption: EncryptionPort,
  ) {}

  async findAll(): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactions',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    if (!data?.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toEntity(row, dek));
  }

  async findById(id: string): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'getTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }

    const dek = await this.getDek();
    return this.toEntity(data, dek);
  }

  async findByBudgetId(budgetId: string): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('budget_id', budgetId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudget',
          entityId: budgetId,
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

  async findByBudgetLineId(budgetLineId: string): Promise<Transaction[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('transaction')
      .select('*')
      .eq('budget_line_id', budgetLineId)
      .order('transaction_date', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'listTransactionsByBudgetLine',
          entityId: budgetLineId,
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

  async insert(input: TransactionCreateInput): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const insertRow = await this.toInsertRow(input, user);

    const { data: row, error } = await supabase
      .from('transaction')
      .insert(insertRow)
      .select()
      .single();

    if (error || !row) {
      const loggingContext = {
        operation: 'createTransaction',
        entityType: 'transaction',
        supabaseError: error,
      };

      if (error?.code === '23505') {
        throw new BusinessException(
          ERROR_DEFINITIONS.TRANSACTION_ALREADY_EXISTS,
          { id: input.id },
          loggingContext,
          { cause: error },
        );
      }

      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_CREATE_FAILED,
        undefined,
        loggingContext,
        { cause: error ?? undefined },
      );
    }

    const dek = await this.getDek();
    return this.toEntity(row, dek);
  }

  async update(
    id: string,
    patch: TransactionUpdatePatch,
  ): Promise<Transaction> {
    const supabase = this.supabaseProvider.client;
    const user = this.supabaseProvider.user;

    const updateRow = await this.toUpdateRow(patch, user);

    const { data: row, error } = await supabase
      .from('transaction')
      .update(updateRow)
      .eq('id', id)
      .select()
      .single();

    if (error || !row) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'updateTransaction',
          entityId: id,
          entityType: 'transaction',
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
    const { error } = await supabase.from('transaction').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_NOT_FOUND,
        { id },
        {
          operation: 'deleteTransaction',
          entityId: id,
          entityType: 'transaction',
          supabaseError: error,
        },
      );
    }
  }

  async toggleCheck(id: string): Promise<Transaction> {
    const current = await this.findById(id);
    const newCheckedAt =
      current.checkedAt === null ? new Date().toISOString() : null;

    return this.update(id, { checkedAt: newCheckedAt });
  }

  async fetchBudgetIdForTransaction(id: string): Promise<string> {
    const supabase = this.supabaseProvider.client;
    const { data } = await supabase
      .from('transaction')
      .select('budget_id')
      .eq('id', id)
      .single();

    return data?.budget_id ?? '';
  }

  async fetchBudgetLineForAllocation(
    budgetLineId: string,
  ): Promise<BudgetLineForAllocation | null> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id, budget_id, kind')
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      budgetId: data.budget_id,
      kind: data.kind,
    };
  }

  async assertBudgetLineExists(budgetLineId: string): Promise<void> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('budget_line')
      .select('id')
      .eq('id', budgetLineId)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_LINE_NOT_FOUND,
        { id: budgetLineId },
        {
          operation: 'assertBudgetLineExists',
          entityId: budgetLineId,
          entityType: 'budget_line',
          supabaseError: error,
        },
      );
    }
  }

  async fetchBudgetIdsByYears(
    _userId: string,
    years: number[],
  ): Promise<string[]> {
    const supabase = this.supabaseProvider.client;
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id')
      .in('year', years);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetIdsByYears',
          entityType: 'monthly_budget',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return data?.map((b) => b.id) ?? [];
  }

  async fetchTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<TransactionSearchTransactionRow[]> {
    const data = await this.queryTransactionsByPattern(
      searchPattern,
      budgetIds,
    );

    if (!data.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toSearchTransactionRow(row, dek));
  }

  async fetchBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<TransactionSearchBudgetLineRow[]> {
    const data = await this.queryBudgetLinesByPattern(searchPattern, budgetIds);

    if (!data.length) return [];
    const dek = await this.getDek();
    return data.map((row) => this.toSearchBudgetLineRow(row, dek));
  }

  private async queryTransactionsByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<RawSearchTransactionRow[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('transaction')
      .select(
        `
        id,
        name,
        amount,
        kind,
        transaction_date,
        category,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .or(`name.ilike.${searchPattern},category.ilike.${searchPattern}`);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchTransactionsByPattern',
          entityType: 'transaction',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as RawSearchTransactionRow[];
  }

  private async queryBudgetLinesByPattern(
    searchPattern: string,
    budgetIds: string[] | null,
  ): Promise<RawSearchBudgetLineRow[]> {
    const supabase = this.supabaseProvider.client;
    let query = supabase
      .from('budget_line')
      .select(
        `
        id,
        name,
        amount,
        kind,
        recurrence,
        budget_id,
        budget:budget_id (
          description,
          month,
          year
        )
      `,
      )
      .ilike('name', searchPattern);

    if (budgetIds) {
      query = query.in('budget_id', budgetIds);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(25);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TRANSACTION_FETCH_FAILED,
        undefined,
        {
          operation: 'fetchBudgetLinesByPattern',
          entityType: 'budget_line',
          supabaseError: error,
        },
        { cause: error },
      );
    }

    return (data ?? []) as RawSearchBudgetLineRow[];
  }

  private async getDek(): Promise<Buffer> {
    const user = this.supabaseProvider.user;
    return this.encryption.getUserDEK(user.id, user.clientKey);
  }

  private toEntity(row: TransactionRow, dek: Buffer): Transaction {
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

  private toSearchTransactionRow(
    row: RawSearchTransactionRow,
    dek: Buffer,
  ): TransactionSearchTransactionRow {
    return {
      id: row.id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      kind: row.kind,
      transactionDate: row.transaction_date,
      category: row.category,
      budgetId: row.budget_id,
      budget: row.budget as TransactionSearchTransactionRow['budget'],
    };
  }

  private toSearchBudgetLineRow(
    row: RawSearchBudgetLineRow,
    dek: Buffer,
  ): TransactionSearchBudgetLineRow {
    return {
      id: row.id,
      name: row.name,
      amount: row.amount
        ? this.encryption.tryDecryptAmount(row.amount, dek, 0)
        : 0,
      kind: row.kind,
      recurrence: row.recurrence,
      budgetId: row.budget_id,
      budget: row.budget as TransactionSearchBudgetLineRow['budget'],
    };
  }

  private async toInsertRow(
    input: TransactionCreateInput,
    user: AuthenticatedUser,
  ): Promise<TransactionInsert> {
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
      budget_line_id: input.budgetLineId ?? null,
      name: input.name,
      amount: encryptedAmount,
      original_amount: encryptedOriginalAmount,
      kind: input.kind as TransactionKind,
      transaction_date: input.transactionDate,
      category: input.category ?? null,
      checked_at: input.checkedAt ?? null,
      ...mapCurrencyMetadataToDb({
        originalCurrency: input.originalCurrency,
        targetCurrency: input.targetCurrency,
        exchangeRate: input.exchangeRate,
      }),
    };
  }

  private async toUpdateRow(
    patch: TransactionUpdatePatch,
    user: AuthenticatedUser,
  ): Promise<TransactionUpdate> {
    const updateData: TransactionUpdate = this.buildScalarUpdates(patch);

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

  private buildScalarUpdates(patch: TransactionUpdatePatch): TransactionUpdate {
    const updateData: TransactionUpdate = {};
    if (patch.name !== undefined) updateData.name = patch.name;
    if (patch.kind !== undefined)
      updateData.kind = patch.kind as TransactionKind;
    if (patch.transactionDate !== undefined)
      updateData.transaction_date = patch.transactionDate;
    if (patch.category !== undefined) updateData.category = patch.category;
    if (patch.checkedAt !== undefined) updateData.checked_at = patch.checkedAt;
    return updateData;
  }
}

interface RawSearchTransactionRow {
  id: string;
  name: string;
  amount: string | null;
  kind: string;
  transaction_date: string;
  category: string | null;
  budget_id: string;
  budget: unknown;
}

interface RawSearchBudgetLineRow {
  id: string;
  name: string;
  amount: string | null;
  kind: string;
  recurrence: 'fixed' | 'one_off';
  budget_id: string;
  budget: unknown;
}
