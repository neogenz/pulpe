import { Injectable } from '@nestjs/common';
import { Result } from '@shared/domain/enhanced-result';
import { BaseRepository } from '@shared/infrastructure/logging/base-repository';
import { EnhancedLoggerService } from '@shared/infrastructure/logging/enhanced-logger.service';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import { Budget } from '../../domain/entities/budget.entity';
import { BudgetPeriod } from '../../domain/value-objects/budget-period.value-object';
import { BudgetRepository } from '../../domain/repositories';
import { BudgetMapper } from '../mappers/budget.mapper';
import type { Tables } from '@/types/database.types';

@Injectable()
export class SupabaseBudgetRepository
  extends BaseRepository
  implements BudgetRepository
{
  constructor(
    protected readonly logger: EnhancedLoggerService,
    private readonly mapper: BudgetMapper,
  ) {
    super(logger, 'BudgetRepository');
  }

  async findById(id: string, userId: string): Promise<Result<Budget | null>> {
    return this.executeQuery(
      'findById',
      { id, userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { data, error } = await client
          .from('monthly_budget')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            return Result.ok(null);
          }
          return Result.fail(error);
        }

        // RLS will ensure only the user's budgets are returned
        const budget = this.mapper.toDomain(data as Tables<'monthly_budget'>);
        return Result.ok(budget);
      },
    );
  }

  async findByPeriod(
    period: BudgetPeriod,
    userId: string,
  ): Promise<Result<Budget | null>> {
    return this.executeQuery(
      'findByPeriod',
      { period: period.toString(), userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { data, error } = await client
          .from('monthly_budget')
          .select('*')
          .eq('month', period.month)
          .eq('year', period.year)
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            return Result.ok(null);
          }
          return Result.fail(error);
        }

        const budget = this.mapper.toDomain(data as Tables<'monthly_budget'>);
        return Result.ok(budget);
      },
    );
  }

  async findByUserId(userId: string): Promise<Result<Budget[]>> {
    return this.executeQuery(
      'findByUserId',
      { userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { data, error } = await client
          .from('monthly_budget')
          .select('*')
          .order('year', { ascending: false })
          .order('month', { ascending: false });

        if (error) {
          return Result.fail(error);
        }

        const budgets = (data || []).map((row) =>
          this.mapper.toDomain(row as Tables<'monthly_budget'>),
        );
        return Result.ok(budgets);
      },
    );
  }

  async existsForPeriod(
    period: BudgetPeriod,
    userId: string,
    excludeId?: string,
  ): Promise<Result<boolean>> {
    return this.executeQuery(
      'existsForPeriod',
      { period: period.toString(), userId, excludeId },
      async (client: AuthenticatedSupabaseClient) => {
        let query = client
          .from('monthly_budget')
          .select('id')
          .eq('month', period.month)
          .eq('year', period.year);

        if (excludeId) {
          query = query.neq('id', excludeId);
        }

        const { data, error } = await query.single();

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned
            return Result.ok(false);
          }
          return Result.fail(error);
        }

        return Result.ok(!!data);
      },
    );
  }

  async save(budget: Budget): Promise<Result<void>> {
    return this.executeCommand(
      'save',
      { budgetId: budget.id },
      async (client: AuthenticatedSupabaseClient) => {
        const dbData = this.mapper.toPersistence(budget);

        // Check if it's an update or insert
        const { data: existing } = await client
          .from('monthly_budget')
          .select('id')
          .eq('id', budget.id)
          .single();

        if (existing) {
          // Update
          const { error } = await client
            .from('monthly_budget')
            .update(dbData)
            .eq('id', budget.id);

          if (error) {
            return Result.fail(error);
          }
        } else {
          // Insert
          const { error } = await client.from('monthly_budget').insert(dbData);

          if (error) {
            return Result.fail(error);
          }
        }

        return Result.ok();
      },
    );
  }

  async delete(id: string, userId: string): Promise<Result<void>> {
    return this.executeCommand(
      'delete',
      { id, userId },
      async (client: AuthenticatedSupabaseClient) => {
        const { error } = await client
          .from('monthly_budget')
          .delete()
          .eq('id', id);

        if (error) {
          return Result.fail(error);
        }

        return Result.ok();
      },
    );
  }

  async createFromTemplate(
    budget: Budget,
    templateId: string,
  ): Promise<Result<{ budgetLinesCreated: number }>> {
    return this.executeCommand(
      'createFromTemplate',
      { budgetId: budget.id, templateId },
      async (client: AuthenticatedSupabaseClient) => {
        // Use atomic database function to create budget with transactions
        const { data: result, error } = await client.rpc(
          'create_budget_from_template',
          {
            p_user_id: budget.userId,
            p_template_id: templateId,
            p_month: budget.period.month,
            p_year: budget.period.year,
            p_description: budget.description,
          },
        );

        if (error) {
          this.logger.error(
            {
              error,
              budgetId: budget.id,
              templateId,
            },
            'Atomic budget creation from template failed',
          );

          // Handle specific database errors
          if (
            error.message?.includes('Template not found') ||
            error.message?.includes('access denied')
          ) {
            return Result.fail(
              new Error('Template not found or access denied'),
            );
          }
          if (error.message?.includes('Budget already exists')) {
            return Result.fail(
              new Error('Budget already exists for this period'),
            );
          }

          return Result.fail(error);
        }

        if (!result || typeof result !== 'object' || !('budget' in result)) {
          this.logger.error(
            { result, budgetId: budget.id, templateId },
            'Invalid result returned from create_budget_from_template',
          );
          return Result.fail(
            new Error('Invalid result from database function'),
          );
        }

        const budgetLinesCreated = result.budget_lines_created as number;
        const templateName = result.template_name as string;

        this.logger.info(
          {
            budgetId: budget.id,
            templateId,
            templateName,
            budgetLinesCreated,
          },
          'Successfully created budget from template with atomic transaction',
        );

        return Result.ok({ budgetLinesCreated });
      },
    );
  }

  /**
   * Set the Supabase client for this repository
   */
  setClient(client: AuthenticatedSupabaseClient): void {
    this.client = client;
  }
}
