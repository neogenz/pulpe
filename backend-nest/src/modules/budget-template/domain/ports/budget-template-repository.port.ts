import type {
  BudgetTemplate,
  BudgetTemplateUpdatePatch,
  BulkTemplateLineOperationsInput,
  CreateTemplateWithLinesInput,
  MonthlyBudgetRow,
  TemplateLine,
  TemplateLineCreateInput,
  TemplateLineUpdatePatch,
  TemplateUsageBudget,
} from '../budget-template.entity';

export const BUDGET_TEMPLATE_REPOSITORY = Symbol('BUDGET_TEMPLATE_REPOSITORY');

/**
 * Result of a bulk template-line operations RPC. The repo encrypts inputs,
 * invokes the RPC atomically (all template + budget writes in a single SQL
 * transaction), then re-fetches and decrypts the affected template_line rows
 * before returning.
 */
export interface BulkTemplateLineOperationsRepoResult {
  affectedBudgetIds: string[];
  updatedLines: TemplateLine[];
  createdLines: TemplateLine[];
}

export interface BudgetTemplateRepositoryPort {
  // Template CRUD — return entities
  findAllForUser(userId: string): Promise<BudgetTemplate[]>;
  findById(id: string, userId: string): Promise<BudgetTemplate>;
  validateAccess(id: string, userId: string): Promise<BudgetTemplate>;
  countForUser(userId: string): Promise<number>;
  resetDefaultTemplates(userId: string, exceptId: string | null): Promise<void>;
  update(id: string, patch: BudgetTemplateUpdatePatch): Promise<BudgetTemplate>;
  delete(id: string): Promise<void>;

  // Template Line CRUD — return entities; accept plain numbers
  findLinesByTemplateId(templateId: string): Promise<TemplateLine[]>;
  insertLine(input: TemplateLineCreateInput): Promise<TemplateLine>;
  findLineById(
    lineId: string,
  ): Promise<{ line: TemplateLine; templateUserId: string | null }>;
  validateLineAccess(lineId: string, userId: string): Promise<TemplateLine>;
  updateLine(
    lineId: string,
    patch: TemplateLineUpdatePatch,
  ): Promise<TemplateLine>;
  deleteLine(lineId: string): Promise<void>;

  // Validation queries
  isTemplateInUse(templateId: string): Promise<boolean>;
  fetchTemplateBudgets(templateId: string): Promise<TemplateUsageBudget[]>;
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

  // RPC orchestration — encrypt inputs, decrypt outputs, validate Zod payload internally
  createTemplateWithLines(
    input: CreateTemplateWithLinesInput,
  ): Promise<BudgetTemplate>;
  bulkApplyTemplateLineOperations(
    input: BulkTemplateLineOperationsInput,
  ): Promise<BulkTemplateLineOperationsRepoResult>;
}
