import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Result } from '@shared/domain/enhanced-result';
import { PinoLogger } from 'nestjs-pino';
import { GenericDomainException } from '@shared/domain/exceptions/generic-domain.exception';
import {
  type BudgetLineRepository,
  type BudgetLineFilters,
} from '../../domain/repositories/budget-line.repository';
import { BudgetLine } from '../../domain/entities/budget-line.entity';
import { BudgetLineAmount } from '../../domain/value-objects/budget-line-amount.value-object';
import { BudgetLineCategory } from '../../domain/value-objects/budget-line-category.value-object';
import type { Database } from '@/types/database.types';

type BudgetLineRow = Database['public']['Tables']['budget_line']['Row'];
type BudgetLineInsert = Database['public']['Tables']['budget_line']['Insert'];
type BudgetLineUpdate = Database['public']['Tables']['budget_line']['Update'];

@Injectable()
export class SupabaseBudgetLineRepository implements BudgetLineRepository {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SupabaseBudgetLineRepository.name);
  }

  async findById(
    id: string,
    userId: string,
  ): Promise<Result<BudgetLine | null>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      const { data, error } = await supabase
        .from('budget_line')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return Result.ok(null);
        }

        this.logger.error({
          operation: 'budget-line-repository.find-by-id.error',
          userId,
          budgetLineId: id,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to find budget line',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      if (!data) {
        return Result.ok(null);
      }

      const budgetLine = await this.toDomain(data);
      return budgetLine ? Result.ok(budgetLine) : Result.ok(null);
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.find-by-id.error',
        userId,
        budgetLineId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to find budget line',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async findAll(
    userId: string,
    filters?: BudgetLineFilters,
  ): Promise<Result<BudgetLine[]>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      let query = supabase.from('budget_line').select('*');

      // Apply filters
      if (filters?.budgetId) {
        query = query.eq('budget_id', filters.budgetId);
      }
      if (filters?.templateLineId) {
        query = query.eq('template_line_id', filters.templateLineId);
      }
      if (filters?.savingsGoalId) {
        query = query.eq('savings_goal_id', filters.savingsGoalId);
      }
      if (filters?.kind) {
        query = query.eq('kind', filters.kind);
      }
      if (filters?.recurrence) {
        query = query.eq('recurrence', filters.recurrence);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.find-all.error',
          userId,
          filters,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to find budget lines',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      const budgetLines = await Promise.all(
        (data || []).map((row) => this.toDomain(row)),
      );

      return Result.ok(budgetLines.filter(Boolean) as BudgetLine[]);
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.find-all.error',
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to find budget lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async findByBudgetId(
    budgetId: string,
    userId: string,
  ): Promise<Result<BudgetLine[]>> {
    return this.findAll(userId, { budgetId });
  }

  async findByTemplateLineId(
    templateLineId: string,
    userId: string,
  ): Promise<Result<BudgetLine[]>> {
    return this.findAll(userId, { templateLineId });
  }

  async save(
    budgetLine: BudgetLine,
    userId: string,
  ): Promise<Result<BudgetLine>> {
    try {
      const supabase = this.getSupabaseClient(userId);
      const data = this.toPersistence(budgetLine);

      // Check if it's an update or insert
      const exists = await this.exists(budgetLine.id, userId);
      if (exists.isFailure) {
        return Result.fail(exists.error);
      }

      if (exists.getValue()) {
        // Update
        const { data: updated, error } = await supabase
          .from('budget_line')
          .update(data as BudgetLineUpdate)
          .eq('id', budgetLine.id)
          .select()
          .single();

        if (error) {
          this.logger.error({
            operation: 'budget-line-repository.update.error',
            userId,
            budgetLineId: budgetLine.id,
            error: error.message,
          });

          return Result.fail(
            new GenericDomainException(
              'Failed to update budget line',
              'REPOSITORY_ERROR',
              error.message,
            ),
          );
        }

        const updatedBudgetLine = await this.toDomain(updated);
        return updatedBudgetLine
          ? Result.ok(updatedBudgetLine)
          : Result.fail(
              new GenericDomainException(
                'Failed to parse updated budget line',
                'PARSE_ERROR',
                'Could not parse updated budget line',
              ),
            );
      } else {
        // Insert
        const { data: inserted, error } = await supabase
          .from('budget_line')
          .insert(data as BudgetLineInsert)
          .select()
          .single();

        if (error) {
          this.logger.error({
            operation: 'budget-line-repository.insert.error',
            userId,
            error: error.message,
          });

          return Result.fail(
            new GenericDomainException(
              'Failed to create budget line',
              'REPOSITORY_ERROR',
              error.message,
            ),
          );
        }

        const insertedBudgetLine = await this.toDomain(inserted);
        return insertedBudgetLine
          ? Result.ok(insertedBudgetLine)
          : Result.fail(
              new GenericDomainException(
                'Failed to parse inserted budget line',
                'PARSE_ERROR',
                'Could not parse inserted budget line',
              ),
            );
      }
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.save.error',
        userId,
        budgetLineId: budgetLine.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to save budget line',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async saveMany(
    budgetLines: BudgetLine[],
    userId: string,
  ): Promise<Result<BudgetLine[]>> {
    try {
      const supabase = this.getSupabaseClient(userId);
      const data = budgetLines.map((bl) => this.toPersistence(bl));

      const { data: inserted, error } = await supabase
        .from('budget_line')
        .insert(data as BudgetLineInsert[])
        .select();

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.save-many.error',
          userId,
          count: budgetLines.length,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to create budget lines',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      const insertedBudgetLines = await Promise.all(
        (inserted || []).map((row) => this.toDomain(row)),
      );

      return Result.ok(insertedBudgetLines.filter(Boolean) as BudgetLine[]);
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.save-many.error',
        userId,
        count: budgetLines.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to save budget lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async delete(id: string, userId: string): Promise<Result<void>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      const { error } = await supabase
        .from('budget_line')
        .delete()
        .eq('id', id);

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.delete.error',
          userId,
          budgetLineId: id,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to delete budget line',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.delete.error',
        userId,
        budgetLineId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete budget line',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async deleteByBudgetId(
    budgetId: string,
    userId: string,
  ): Promise<Result<void>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      const { error } = await supabase
        .from('budget_line')
        .delete()
        .eq('budget_id', budgetId);

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.delete-by-budget.error',
          userId,
          budgetId,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to delete budget lines',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      return Result.ok();
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.delete-by-budget.error',
        userId,
        budgetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to delete budget lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async exists(id: string, userId: string): Promise<Result<boolean>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      const { count, error } = await supabase
        .from('budget_line')
        .select('id', { count: 'exact', head: true })
        .eq('id', id);

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.exists.error',
          userId,
          budgetLineId: id,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to check budget line existence',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      return Result.ok(count !== null && count > 0);
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.exists.error',
        userId,
        budgetLineId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to check budget line existence',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async countByBudgetId(
    budgetId: string,
    userId: string,
  ): Promise<Result<number>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      const { count, error } = await supabase
        .from('budget_line')
        .select('id', { count: 'exact', head: true })
        .eq('budget_id', budgetId);

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.count-by-budget.error',
          userId,
          budgetId,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to count budget lines',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      return Result.ok(count || 0);
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.count-by-budget.error',
        userId,
        budgetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to count budget lines',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  async calculateTotalForBudget(
    budgetId: string,
    userId: string,
  ): Promise<Result<number>> {
    try {
      const supabase = this.getSupabaseClient(userId);

      const { data, error } = await supabase
        .from('budget_line')
        .select('amount')
        .eq('budget_id', budgetId);

      if (error) {
        this.logger.error({
          operation: 'budget-line-repository.calculate-total.error',
          userId,
          budgetId,
          error: error.message,
        });

        return Result.fail(
          new GenericDomainException(
            'Failed to calculate total',
            'REPOSITORY_ERROR',
            error.message,
          ),
        );
      }

      const total = (data || []).reduce(
        (sum, row) => sum + (row.amount || 0),
        0,
      );
      return Result.ok(total);
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.calculate-total.error',
        userId,
        budgetId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return Result.fail(
        new GenericDomainException(
          'Failed to calculate total',
          'REPOSITORY_ERROR',
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  private getSupabaseClient(userId: string): SupabaseClient<Database> {
    // This would be injected in real implementation
    // For now, we'll throw an error to indicate it needs to be implemented
    throw new Error('Supabase client injection not implemented');
  }

  private async toDomain(row: BudgetLineRow): Promise<BudgetLine | null> {
    try {
      const amountResult = BudgetLineAmount.create(row.amount);
      if (amountResult.isFailure) {
        this.logger.error({
          operation: 'budget-line-repository.to-domain.invalid-amount',
          budgetLineId: row.id,
          amount: row.amount,
          error: amountResult.error.message,
        });
        return null;
      }

      const categoryResult = BudgetLineCategory.create({
        name: row.name,
        kind: row.kind as any,
        recurrence: row.recurrence as any,
        isManuallyAdjusted: row.is_manually_adjusted,
      });
      if (categoryResult.isFailure) {
        this.logger.error({
          operation: 'budget-line-repository.to-domain.invalid-category',
          budgetLineId: row.id,
          error: categoryResult.error.message,
        });
        return null;
      }

      const budgetLineResult = BudgetLine.create(
        {
          budgetId: row.budget_id,
          templateLineId: row.template_line_id,
          savingsGoalId: row.savings_goal_id,
          category: categoryResult.getValue(),
          amount: amountResult.getValue(),
        },
        row.id,
      );

      if (budgetLineResult.isFailure) {
        this.logger.error({
          operation: 'budget-line-repository.to-domain.invalid-entity',
          budgetLineId: row.id,
          error: budgetLineResult.error.message,
        });
        return null;
      }

      return budgetLineResult.getValue();
    } catch {
      this.logger.error({
        operation: 'budget-line-repository.to-domain.error',
        budgetLineId: row.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private toPersistence(budgetLine: BudgetLine): Partial<BudgetLineRow> {
    const snapshot = budgetLine.toSnapshot();

    return {
      id: snapshot.id,
      budget_id: snapshot.budgetId,
      template_line_id: snapshot.templateLineId,
      savings_goal_id: snapshot.savingsGoalId,
      name: snapshot.name,
      amount: snapshot.amount,
      kind: snapshot.kind,
      recurrence: snapshot.recurrence,
      is_manually_adjusted: snapshot.isManuallyAdjusted,
      created_at: snapshot.createdAt.toISOString(),
      updated_at: snapshot.updatedAt.toISOString(),
    };
  }
}
