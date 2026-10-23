import type {
  BudgetTemplate,
  TemplateLine,
  TemplateUsageBudget,
} from '../budget-template.entity';

export const BUDGET_TEMPLATE_READ_PORT = Symbol('BUDGET_TEMPLATE_READ_PORT');

/** A template, its lines (tags included) and every month built from it. */
export interface TemplateDetails {
  template: BudgetTemplate;
  lines: TemplateLine[];
  months: TemplateUsageBudget[];
}

/**
 * Read the user's month models, for in-process consumers (the MCP agent
 * connector). Requires the caller to have put `user` and `supabase` in CLS,
 * exactly like an HTTP request does.
 *
 * `get` rejects with `TEMPLATE_NOT_FOUND` on an unknown or foreign id.
 */
export interface BudgetTemplateReadPort {
  list(): Promise<BudgetTemplate[]>;
  get(id: string): Promise<TemplateDetails>;
}
