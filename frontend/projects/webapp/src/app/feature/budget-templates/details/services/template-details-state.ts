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
