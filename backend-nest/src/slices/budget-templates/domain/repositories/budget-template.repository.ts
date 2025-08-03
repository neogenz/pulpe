import { Result } from '@shared/domain/enhanced-result';
import { BudgetTemplate } from '../entities/budget-template.entity';
import { TemplateLine } from '../value-objects/template-line.value-object';

export const BUDGET_TEMPLATE_REPOSITORY_TOKEN = 'BudgetTemplateRepository';

export interface BudgetTemplateRepository {
  /**
   * Find a template by ID
   */
  findById(id: string, userId: string): Promise<Result<BudgetTemplate | null>>;

  /**
   * Find all templates for a user
   */
  findByUserId(userId: string): Promise<Result<BudgetTemplate[]>>;

  /**
   * Find the default template for a user
   */
  findDefaultByUserId(userId: string): Promise<Result<BudgetTemplate | null>>;

  /**
   * Save a template (create or update)
   */
  save(template: BudgetTemplate): Promise<Result<BudgetTemplate>>;

  /**
   * Save a template with its lines in a transaction
   */
  saveWithLines(template: BudgetTemplate): Promise<Result<BudgetTemplate>>;

  /**
   * Delete a template
   */
  delete(id: string, userId: string): Promise<Result<void>>;

  /**
   * Check if a template exists
   */
  exists(id: string, userId: string): Promise<Result<boolean>>;

  /**
   * Count templates for a user
   */
  countByUserId(userId: string): Promise<Result<number>>;

  /**
   * Set a template as default (and unset others)
   */
  setAsDefault(id: string, userId: string): Promise<Result<void>>;

  /**
   * Find all template lines for a template
   */
  findLinesByTemplateId(
    templateId: string,
    userId: string,
  ): Promise<Result<TemplateLine[]>>;

  /**
   * Save template lines
   */
  saveLines(
    templateId: string,
    lines: TemplateLine[],
    userId: string,
  ): Promise<Result<TemplateLine[]>>;

  /**
   * Delete a template line
   */
  deleteLine(
    templateId: string,
    lineId: string,
    userId: string,
  ): Promise<Result<void>>;

  /**
   * Delete all lines for a template
   */
  deleteAllLines(templateId: string, userId: string): Promise<Result<void>>;
}
