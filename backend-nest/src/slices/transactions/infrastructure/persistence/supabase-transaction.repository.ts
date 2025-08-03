import { Injectable } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { BaseRepository } from '@shared/infrastructure/logging/base-repository';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Transaction } from '../../domain/entities/transaction.entity';
import {
  TransactionRepository,
  type TransactionFilters,
  type PaginationOptions,
  type TransactionListResult,
  type BulkImportResult,
} from '../../domain/repositories';
import { TransactionMapper } from '../mappers/transaction.mapper';
import type { Tables } from '@/types/database.types';

@Injectable()
export class SupabaseTransactionRepository
  extends BaseRepository
  implements TransactionRepository
{
  constructor(
    protected readonly logger: EnhancedLoggerService,
    private readonly mapper: TransactionMapper,
  ) {
    super(logger, 'TransactionRepository');
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<Result<Transaction | null>> {
    return this.executeQuery(
      'findById',
      { id, userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { data, error } = await client
          .from('transaction')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return Result.ok(null);
          }
          return Result.fail(error);
        }

        const transaction = this.mapper.toDomain(data as Tables<'transaction'>);
        return Result.ok(transaction);
      },
    );
  }

  async findByUserId(
    userId: string,
    filters?: TransactionFilters,
    pagination?: PaginationOptions,
  ): Promise<Result<TransactionListResult>> {
    return this.executeQuery(
      'findByUserId',
      { userId, filters, pagination },
      async (client: AuthenticatedSupabaseClient) => {
        let query = client.from('transaction').select('*', { count: 'exact' });

        // Apply filters
        if (filters) {
          if (filters.budgetId) {
            query = query.eq('budget_id', filters.budgetId);
          }
          if (filters.category) {
            query = query.eq('category', filters.category);
          }
          if (filters.isOutOfBudget !== undefined) {
            query = query.eq('is_out_of_budget', filters.isOutOfBudget);
          }
          if (filters.kind) {
            query = query.eq('kind', filters.kind);
          }
          if (filters.dateFrom) {
            query = query.gte(
              'transaction_date',
              filters.dateFrom.toISOString(),
            );
          }
          if (filters.dateTo) {
            query = query.lte('transaction_date', filters.dateTo.toISOString());
          }
          if (filters.amountMin !== undefined) {
            query = query.gte('amount', filters.amountMin);
          }
          if (filters.amountMax !== undefined) {
            query = query.lte('amount', filters.amountMax);
          }
          if (filters.searchTerm) {
            query = query.ilike('name', `%${filters.searchTerm}%`);
          }
        }

        // Apply sorting
        const orderBy = pagination?.orderBy || 'date';
        const orderDirection = pagination?.orderDirection || 'desc';
        switch (orderBy) {
          case 'date':
            query = query.order('transaction_date', {
              ascending: orderDirection === 'asc',
            });
            break;
          case 'amount':
            query = query.order('amount', {
              ascending: orderDirection === 'asc',
            });
            break;
          case 'name':
            query = query.order('name', {
              ascending: orderDirection === 'asc',
            });
            break;
        }

        // Apply pagination
        if (pagination?.limit) {
          query = query.limit(pagination.limit);
        }
        if (pagination?.offset) {
          query = query.range(
            pagination.offset,
            pagination.offset + (pagination.limit || 100) - 1,
          );
        }

        const { data, error, count } = await query;

        if (error) {
          return Result.fail(error);
        }

        const transactions = (data || []).map((row) =>
          this.mapper.toDomain(row as Tables<'transaction'>),
        );

        return Result.ok<TransactionListResult>({
          transactions,
          total: count || 0,
        });
      },
    );
  }

  async findByBudgetId(
    budgetId: string,
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<Result<Transaction[]>> {
    return this.executeQuery(
      'findByBudgetId',
      { budgetId, userId, pagination },
      async (client: AuthenticatedSupabaseClient) => {
        let query = client
          .from('transaction')
          .select('*')
          .eq('budget_id', budgetId)
          .order('transaction_date', { ascending: false });

        if (pagination?.limit) {
          query = query.limit(pagination.limit);
        }
        if (pagination?.offset) {
          query = query.range(
            pagination.offset,
            pagination.offset + (pagination.limit || 100) - 1,
          );
        }

        const { data, error } = await query;

        if (error) {
          return Result.fail(error);
        }

        const transactions = (data || []).map((row) =>
          this.mapper.toDomain(row as Tables<'transaction'>),
        );

        return Result.ok(transactions);
      },
    );
  }

  async findByCategory(
    category: string,
    userId: string,
    pagination?: PaginationOptions,
  ): Promise<Result<Transaction[]>> {
    return this.executeQuery(
      'findByCategory',
      { category, userId, pagination },
      async (client: AuthenticatedSupabaseClient) => {
        let query = client
          .from('transaction')
          .select('*')
          .eq('category', category)
          .order('transaction_date', { ascending: false });

        if (pagination?.limit) {
          query = query.limit(pagination.limit);
        }
        if (pagination?.offset) {
          query = query.range(
            pagination.offset,
            pagination.offset + (pagination.limit || 100) - 1,
          );
        }

        const { data, error } = await query;

        if (error) {
          return Result.fail(error);
        }

        const transactions = (data || []).map((row) =>
          this.mapper.toDomain(row as Tables<'transaction'>),
        );

        return Result.ok(transactions);
      },
    );
  }

  async save(transaction: Transaction): Promise<Result<void>> {
    return this.executeQuery(
      'save',
      { transactionId: transaction.id },
      async (client: AuthenticatedSupabaseClient) => {
        const dbData = this.mapper.toDbInsert(transaction);

        if (transaction.createdAt === transaction.updatedAt) {
          // Insert new transaction
          const { error } = await client.from('transaction').insert({
            id: transaction.id,
            ...dbData,
          });

          if (error) {
            return Result.fail(error);
          }
        } else {
          // Update existing transaction
          const { error } = await client
            .from('transaction')
            .update(dbData)
            .eq('id', transaction.id);

          if (error) {
            return Result.fail(error);
          }
        }

        return Result.ok();
      },
    );
  }

  async delete(id: string, userId: string): Promise<Result<void>> {
    return this.executeQuery(
      'delete',
      { id, userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { error } = await client
          .from('transaction')
          .delete()
          .eq('id', id);

        if (error) {
          return Result.fail(error);
        }

        return Result.ok();
      },
    );
  }

  async bulkImport(
    transactions: Transaction[],
    userId: string,
  ): Promise<Result<BulkImportResult>> {
    return this.executeQuery(
      'bulkImport',
      { userId, count: transactions.length },
      async (client: AuthenticatedSupabaseClient) => {
        const errors: Array<{ row: number; error: string }> = [];
        let imported = 0;

        // Insert transactions in batches to avoid timeout
        const batchSize = 100;
        for (let i = 0; i < transactions.length; i += batchSize) {
          const batch = transactions.slice(i, i + batchSize);
          const inserts = batch.map((tx) => ({
            id: tx.id,
            ...this.mapper.toDbInsert(tx),
          }));

          const { error } = await client.from('transaction').insert(inserts);

          if (error) {
            // Log which batch failed
            for (let j = 0; j < batch.length; j++) {
              errors.push({
                row: i + j + 1,
                error: error.message,
              });
            }
          } else {
            imported += batch.length;
          }
        }

        return Result.ok<BulkImportResult>({
          imported,
          failed: errors.length,
          errors,
        });
      },
    );
  }

  async getStatsByBudget(
    budgetId: string,
    userId: string,
  ): Promise<
    Result<{
      totalIncome: number;
      totalExpense: number;
      categoryBreakdown: Record<string, number>;
    }>
  > {
    return this.executeQuery(
      'getStatsByBudget',
      { budgetId, userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { data, error } = await client
          .from('transaction')
          .select('amount, kind, category')
          .eq('budget_id', budgetId);

        if (error) {
          return Result.fail(error);
        }

        let totalIncome = 0;
        let totalExpense = 0;
        const categoryBreakdown: Record<string, number> = {};

        for (const tx of data || []) {
          if (tx.kind === 'income') {
            totalIncome += tx.amount;
          } else {
            totalExpense += tx.amount;
          }

          if (tx.category) {
            categoryBreakdown[tx.category] =
              (categoryBreakdown[tx.category] || 0) + tx.amount;
          }
        }

        return Result.ok({
          totalIncome,
          totalExpense,
          categoryBreakdown,
        });
      },
    );
  }

  async userOwnsBudget(
    budgetId: string,
    userId: string,
  ): Promise<Result<boolean>> {
    return this.executeQuery(
      'userOwnsBudget',
      { budgetId, userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { data, error } = await client
          .from('monthly_budget')
          .select('id')
          .eq('id', budgetId)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            return Result.ok(false);
          }
          return Result.fail(error);
        }

        return Result.ok(data !== null);
      },
    );
  }
}
