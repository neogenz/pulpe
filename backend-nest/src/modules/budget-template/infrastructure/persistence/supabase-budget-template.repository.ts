import { Injectable } from '@nestjs/common';
import { type InfoLogger, InjectInfoLogger } from '@common/logger';
import { BusinessException } from '@common/exceptions/business.exception';
import { ERROR_DEFINITIONS } from '@common/constants/error-definitions';
import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type { BudgetTemplateRepositoryPort } from '../../domain/ports/budget-template-repository.port';
import type {
  TemplateRow,
  TemplateUpdate,
  TemplateLineRow,
  TemplateLineInsert,
  MonthlyBudgetRow,
} from '../../domain/budget-template.entity';

@Injectable()
export class SupabaseBudgetTemplateRepository implements BudgetTemplateRepositoryPort {
  constructor(
    @InjectInfoLogger(SupabaseBudgetTemplateRepository.name)
    private readonly logger: InfoLogger,
  ) {}

  async findAllForUser(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow[]> {
    const { data, error } = await supabase
      .from('template')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_FETCH_FAILED,
        undefined,
        { operation: 'findAllForUser', userId },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async findById(
    id: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow> {
    const { data, error } = await supabase
      .from('template')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id },
        { operation: 'findById', userId, entityId: id },
      );
    }

    return data;
  }

  async validateAccess(
    id: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow> {
    const { data, error } = await supabase
      .from('template')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND, {
        id,
      });
    }

    if (data.user_id !== userId) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_ACCESS_FORBIDDEN, {
        id,
      });
    }

    return data;
  }

  async countForUser(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { count, error } = await supabase
      .from('template')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_FETCH_FAILED,
        undefined,
        { operation: 'countForUser', userId },
        { cause: error },
      );
    }

    return count ?? 0;
  }

  async resetDefaultTemplates(
    userId: string,
    exceptId: string | null,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    let query = supabase
      .from('template')
      .update({ is_default: false })
      .eq('user_id', userId)
      .eq('is_default', true);

    if (exceptId) {
      query = query.neq('id', exceptId);
    }

    await query;
  }

  async update(
    id: string,
    data: TemplateUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow> {
    const { data: result, error } = await supabase
      .from('template')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error || !result) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id },
        { operation: 'update', entityId: id },
        { cause: error ?? undefined },
      );
    }

    return result;
  }

  async delete(
    id: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase.from('template').delete().eq('id', id);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_NOT_FOUND,
        { id },
        { operation: 'delete', entityId: id },
        { cause: error },
      );
    }
  }

  async findLinesByTemplateId(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]> {
    const { data, error } = await supabase
      .from('template_line')
      .select('*')
      .eq('template_id', templateId)
      .order('name', { ascending: true });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_FETCH_FAILED,
        undefined,
        { operation: 'findLinesByTemplateId', entityId: templateId },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async insertLine(
    data: TemplateLineInsert,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow> {
    const { data: result, error } = await supabase
      .from('template_line')
      .insert(data)
      .select()
      .single();

    if (error || !result) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_CREATE_FAILED,
        undefined,
        { operation: 'insertLine' },
        { cause: error ?? undefined },
      );
    }

    return result;
  }

  async findLineById(
    lineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow & { template: { user_id: string | null } }> {
    const { data, error } = await supabase
      .from('template_line')
      .select('*, template!inner(*)')
      .eq('id', lineId)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: lineId,
      });
    }

    return data as TemplateLineRow & { template: { user_id: string | null } };
  }

  async validateLineAccess(
    lineId: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow> {
    const { data, error } = await supabase
      .from('template_line')
      .select('*, template!inner(*)')
      .eq('id', lineId)
      .single();

    if (error || !data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND, {
        id: lineId,
      });
    }

    const row = data as TemplateLineRow & {
      template: { user_id: string | null };
    };

    if (row.template.user_id !== userId) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_ACCESS_FORBIDDEN,
        { id: lineId },
      );
    }

    return row;
  }

  async updateLine(
    lineId: string,
    data: Partial<TemplateLineInsert>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow> {
    const { data: result, error } = await supabase
      .from('template_line')
      .update(data)
      .eq('id', lineId)
      .select()
      .single();

    if (error || !result) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND,
        { id: lineId },
        { operation: 'updateLine', entityId: lineId },
        { cause: error ?? undefined },
      );
    }

    return result;
  }

  async updateLinesInBatch(
    ids: string[],
    data: Partial<TemplateLineInsert>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]> {
    const { data: result, error } = await supabase
      .from('template_line')
      .update(data)
      .in('id', ids)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND,
        undefined,
        { operation: 'updateLinesInBatch' },
        { cause: error },
      );
    }

    return result ?? [];
  }

  async insertLines(
    data: TemplateLineInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]> {
    const { data: result, error } = await supabase
      .from('template_line')
      .insert(data)
      .select();

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_CREATE_FAILED,
        undefined,
        { operation: 'insertLines' },
        { cause: error },
      );
    }

    return result ?? [];
  }

  async deleteLine(
    lineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void> {
    const { error } = await supabase
      .from('template_line')
      .delete()
      .eq('id', lineId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND,
        { id: lineId },
        { operation: 'deleteLine', entityId: lineId },
        { cause: error },
      );
    }
  }

  async isTemplateInUse(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<boolean> {
    const { data } = await supabase
      .from('monthly_budget')
      .select('id')
      .eq('template_id', templateId)
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  async fetchTemplateBudgets(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<
    Array<{ id: string; month: number; year: number; description: string }>
  > {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year, description')
      .eq('template_id', templateId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        { operation: 'fetchTemplateBudgets', entityId: templateId },
        { cause: error },
      );
    }

    return (data ?? []) as Array<{
      id: string;
      month: number;
      year: number;
      description: string;
    }>;
  }

  async countOnboardingTemplatesInWindow(
    userId: string,
    sinceIso: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number> {
    const { data } = await supabase
      .from('template')
      .select('id')
      .eq('user_id', userId)
      .eq('is_from_onboarding', true)
      .gte('created_at', sinceIso);

    return data?.length ?? 0;
  }

  async validateLinesExist(
    templateId: string,
    lineIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    if (!lineIds.length) return [];

    const { data } = await supabase
      .from('template_line')
      .select('id')
      .eq('template_id', templateId)
      .in('id', lineIds);

    if (!data || data.length !== lineIds.length) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_LINE_NOT_FOUND);
    }

    return data.map((row) => row.id);
  }

  async fetchFutureBudgets(
    templateId: string,
    userId: string,
    currentPeriod: { year: number; month: number },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Pick<MonthlyBudgetRow, 'id' | 'month' | 'year'>[]> {
    const { year, month } = currentPeriod;
    const futureFilter = `year.gt.${year},and(year.eq.${year},month.gte.${month})`;

    const { data, error } = await supabase
      .from('monthly_budget')
      .select('id, month, year')
      .eq('template_id', templateId)
      .eq('user_id', userId)
      .or(futureFilter);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        { operation: 'fetchFutureBudgets', entityId: templateId },
        { cause: error },
      );
    }

    return (data ?? []) as Pick<MonthlyBudgetRow, 'id' | 'month' | 'year'>[];
  }

  async fetchAllBudgetsForTemplate(
    templateId: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<MonthlyBudgetRow[]> {
    const { data, error } = await supabase
      .from('monthly_budget')
      .select('*')
      .eq('template_id', templateId)
      .eq('user_id', userId);

    if (error) {
      throw new BusinessException(
        ERROR_DEFINITIONS.BUDGET_FETCH_FAILED,
        undefined,
        { operation: 'fetchAllBudgetsForTemplate', entityId: templateId },
        { cause: error },
      );
    }

    return data ?? [];
  }

  async createTemplateWithLinesRpc(
    payload: {
      p_user_id: string;
      p_name: string;
      p_description: string | undefined;
      p_is_default: boolean;
      p_lines: unknown[];
    },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow> {
    const { data, error } = await supabase.rpc('create_template_with_lines', {
      p_user_id: payload.p_user_id,
      p_name: payload.p_name,
      p_description: payload.p_description,
      p_is_default: payload.p_is_default,
      p_lines: payload.p_lines as never,
    });

    if (error) throw error;

    if (!data) {
      throw new BusinessException(ERROR_DEFINITIONS.TEMPLATE_CREATE_FAILED);
    }

    return data as unknown as TemplateRow;
  }

  async applyTemplateLineOperationsRpc(
    payload: {
      template_id: string;
      budget_ids: string[];
      delete_ids: string[];
      updated_lines: unknown[];
      created_lines: unknown[];
    },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]> {
    const { data, error } = await supabase.rpc(
      'apply_template_line_operations',
      {
        template_id: payload.template_id,
        budget_ids: payload.budget_ids,
        delete_ids: payload.delete_ids,
        updated_lines: payload.updated_lines as never,
        created_lines: payload.created_lines as never,
      },
    );

    if (error) throw error;

    if (!data) return [];

    return Array.isArray(data)
      ? (data.filter((id): id is string => Boolean(id)) as string[])
      : [];
  }

  logFutureBudgetsFetch(
    templateId: string,
    userId: string,
    count: number,
  ): void {
    this.logger.info(
      {
        operation: 'fetchFutureBudgets',
        templateId,
        userId,
        futureBudgetsCount: count,
      },
      'Future budgets query completed',
    );
  }
}
