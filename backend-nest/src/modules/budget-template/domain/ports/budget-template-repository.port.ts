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
  findAllForUser(userId: string): Promise<TemplateRow[]>;
  findById(id: string, userId: string): Promise<TemplateRow>;
  validateAccess(id: string, userId: string): Promise<TemplateRow>;
  countForUser(userId: string): Promise<number>;
  resetDefaultTemplates(userId: string, exceptId: string | null): Promise<void>;
  update(id: string, data: TemplateUpdate): Promise<TemplateRow>;
  delete(id: string): Promise<void>;

  // Template Line CRUD
  findLinesByTemplateId(templateId: string): Promise<TemplateLineRow[]>;
  insertLine(data: TemplateLineInsert): Promise<TemplateLineRow>;
  findLineById(
    lineId: string,
  ): Promise<TemplateLineRow & { template: { user_id: string | null } }>;
  validateLineAccess(lineId: string, userId: string): Promise<TemplateLineRow>;
  updateLine(
    lineId: string,
    data: Partial<TemplateLineInsert>,
  ): Promise<TemplateLineRow>;
  updateLinesInBatch(
    ids: string[],
    data: Partial<TemplateLineInsert>,
  ): Promise<TemplateLineRow[]>;
  insertLines(data: TemplateLineInsert[]): Promise<TemplateLineRow[]>;
  deleteLine(lineId: string): Promise<void>;

  // Validation queries
  isTemplateInUse(templateId: string): Promise<boolean>;
  fetchTemplateBudgets(
    templateId: string,
  ): Promise<
    Array<{ id: string; month: number; year: number; description: string }>
  >;
  countOnboardingTemplatesInWindow(
    userId: string,
    sinceIso: string,
  ): Promise<number>;
  validateLinesExist(templateId: string, lineIds: string[]): Promise<string[]>;
  fetchFutureBudgets(
    templateId: string,
    userId: string,
    currentPeriod: { year: number; month: number },
  ): Promise<Pick<MonthlyBudgetRow, 'id' | 'month' | 'year'>[]>;
  fetchAllBudgetsForTemplate(
    templateId: string,
    userId: string,
  ): Promise<MonthlyBudgetRow[]>;

  // RPCs
  createTemplateWithLinesRpc(payload: {
    p_user_id: string;
    p_name: string;
    p_description: string | undefined;
    p_is_default: boolean;
    p_lines: unknown[];
  }): Promise<TemplateRow>;
  applyTemplateLineOperationsRpc(payload: {
    template_id: string;
    budget_ids: string[];
    delete_ids: string[];
    updated_lines: unknown[];
    created_lines: unknown[];
  }): Promise<string[]>;
}
