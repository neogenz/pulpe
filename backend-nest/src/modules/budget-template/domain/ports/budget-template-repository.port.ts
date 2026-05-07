import type { AuthenticatedSupabaseClient } from '@modules/supabase/supabase.service';
import type {
  TemplateRow,
  TemplateUpdate,
  TemplateLineRow,
  TemplateLineInsert,
  MonthlyBudgetRow,
} from '../budget-template.entity';

export const BUDGET_TEMPLATE_REPOSITORY = Symbol('BUDGET_TEMPLATE_REPOSITORY');

export interface BudgetTemplateRepositoryPort {
  // Template CRUD
  findAllForUser(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow[]>;
  findById(
    id: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow>;
  validateAccess(
    id: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow>;
  countForUser(
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number>;
  resetDefaultTemplates(
    userId: string,
    exceptId: string | null,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;
  update(
    id: string,
    data: TemplateUpdate,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow>;
  delete(id: string, supabase: AuthenticatedSupabaseClient): Promise<void>;

  // Template Line CRUD
  findLinesByTemplateId(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]>;
  insertLine(
    data: TemplateLineInsert,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow>;
  findLineById(
    lineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow & { template: { user_id: string | null } }>;
  validateLineAccess(
    lineId: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow>;
  updateLine(
    lineId: string,
    data: Partial<TemplateLineInsert>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow>;
  updateLinesInBatch(
    ids: string[],
    data: Partial<TemplateLineInsert>,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]>;
  insertLines(
    data: TemplateLineInsert[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateLineRow[]>;
  deleteLine(
    lineId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<void>;

  // Validation queries
  isTemplateInUse(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<boolean>;
  fetchTemplateBudgets(
    templateId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<
    Array<{ id: string; month: number; year: number; description: string }>
  >;
  countOnboardingTemplatesInWindow(
    userId: string,
    sinceIso: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<number>;
  validateLinesExist(
    templateId: string,
    lineIds: string[],
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]>;
  fetchFutureBudgets(
    templateId: string,
    userId: string,
    currentPeriod: { year: number; month: number },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<Pick<MonthlyBudgetRow, 'id' | 'month' | 'year'>[]>;
  fetchAllBudgetsForTemplate(
    templateId: string,
    userId: string,
    supabase: AuthenticatedSupabaseClient,
  ): Promise<MonthlyBudgetRow[]>;

  // RPCs
  createTemplateWithLinesRpc(
    payload: {
      p_user_id: string;
      p_name: string;
      p_description: string | undefined;
      p_is_default: boolean;
      p_lines: unknown[];
    },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<TemplateRow>;
  applyTemplateLineOperationsRpc(
    payload: {
      template_id: string;
      budget_ids: string[];
      delete_ids: string[];
      updated_lines: unknown[];
      created_lines: unknown[];
    },
    supabase: AuthenticatedSupabaseClient,
  ): Promise<string[]>;
}
