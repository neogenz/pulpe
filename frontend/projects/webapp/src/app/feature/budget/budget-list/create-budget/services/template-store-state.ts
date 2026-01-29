import type { BudgetTemplate, TemplateLine } from 'pulpe-shared';
import type { TemplateTotals } from './template-totals-calculator';

export type { TemplateTotals };

export interface TemplateStoreState {
  templates: BudgetTemplate[];
  selectedId: string | null;
  templateLinesCache: Map<string, TemplateLine[]>;
  templateTotalsMap: Record<string, TemplateTotals>;
  isLoading: boolean;
  error: Error | null;
}

export function createInitialTemplateStoreState(): TemplateStoreState {
  return {
    templates: [],
    selectedId: null,
    templateLinesCache: new Map(),
    templateTotalsMap: {},
    isLoading: false,
    error: null,
  };
}
