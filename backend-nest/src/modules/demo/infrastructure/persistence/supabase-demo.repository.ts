import { Injectable } from '@nestjs/common';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type {
  DemoRepositoryPort,
  TemplateInsert,
  TemplateRow,
  TemplateLineInsert,
  MonthlyBudgetInsert,
  BudgetRow,
  BudgetLineInsert,
  TransactionInsert,
} from '../../domain/ports/demo-repository.port';
import type { Tables } from '../../../../types/database.types';

@Injectable()
export class SupabaseDemoRepository implements DemoRepositoryPort {
  async insertTemplates(
    rows: TemplateInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow[]> {
    const { data, error } = await supabase
      .from('template')
      .insert(rows)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoTemplates', supabaseError: error },
        { cause: error },
      );
    }

    return data;
  }

  async insertTemplateLines(
    rows: TemplateLineInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Tables<'template_line'>[]> {
    const { data, error } = await supabase
      .from('template_line')
      .insert(rows)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoTemplateLines', supabaseError: error },
        { cause: error },
      );
    }

    return data;
  }

  async insertBudgets(
    rows: MonthlyBudgetInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<BudgetRow[]> {
    const { data, error } = await supabase
      .from('monthly_budget')
      .insert(rows)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoBudgets', supabaseError: error },
        { cause: error },
      );
    }

    return data;
  }

  async insertBudgetLines(
    rows: BudgetLineInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    if (rows.length === 0) return;

    const { error } = await supabase.from('budget_line').insert(rows);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoBudgetLines', supabaseError: error },
        { cause: error },
      );
    }
  }

  async insertTransactions(
    rows: TransactionInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    if (rows.length === 0) return;

    const { error } = await supabase.from('transaction').insert(rows);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.INTERNAL_SERVER_ERROR,
        undefined,
        { operation: 'insertDemoTransactions', supabaseError: error },
        { cause: error },
      );
    }
  }
}
