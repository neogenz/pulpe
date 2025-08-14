import type { BudgetTemplate, TemplateLine } from '@pulpe/shared';

/**
 * Response structure for template details API
 */
export interface TemplateDetailsResponse {
  template: BudgetTemplate;
  transactions: TemplateLine[];
}

/**
 * State for template details store
 * Manages non-resource state like operation tracking and template ID
 */
export interface TemplateDetailsState {
  /**
   * The current template ID being viewed
   */
  templateId: string | null;

  /**
   * Error message if any operation fails
   */
  error: string | null;
}

/**
 * Factory function to create initial internal state
 */
export function createInitialTemplateDetailsState(): TemplateDetailsState {
  return {
    templateId: null,
    error: null,
  };
}
