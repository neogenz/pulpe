import type {
  BudgetPeriod,
  BudgetTemplateCreate,
  BudgetTemplateUpdate,
  TemplateLinesBulkOperations,
} from 'pulpe-shared';
import type {
  BudgetTemplate,
  BulkTemplateLineOperationsResult,
  TemplateWithLines,
} from '../budget-template.entity';

export const BUDGET_TEMPLATE_WRITE_PORT = Symbol('BUDGET_TEMPLATE_WRITE_PORT');

/**
 * Create, change, delete and copy the user's month models, for in-process
 * consumers (the MCP agent connector). Requires the caller to have put `user`
 * and `supabase` in CLS, exactly like an HTTP request does.
 *
 * `create` and `duplicate` reject with `TEMPLATE_LIMIT_EXCEEDED` past 5
 * templates; `remove` rejects with `TEMPLATE_IN_USE` (months listed) while a
 * month is built from the template. Every call rejects with
 * `TEMPLATE_NOT_FOUND` on an unknown or foreign id.
 *
 * `editLines` propagates to the current cycle and every later month built from
 * the template when `ops.propagateToBudgets` is set; `range` narrows that to
 * the months between `from` and `to`, never to past cycles.
 */
export interface BudgetTemplateWritePort {
  create(dto: BudgetTemplateCreate): Promise<TemplateWithLines>;
  update(id: string, dto: BudgetTemplateUpdate): Promise<BudgetTemplate>;
  remove(id: string): Promise<void>;
  duplicate(id: string, name: string): Promise<TemplateWithLines>;
  editLines(
    id: string,
    ops: TemplateLinesBulkOperations,
    range?: { from: BudgetPeriod; to: BudgetPeriod },
  ): Promise<BulkTemplateLineOperationsResult>;
}
