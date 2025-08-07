/**
 * Configuration utilities for template deletion dialogs
 * Provides consistent dialog configuration across the budget-templates feature
 */

/**
 * Returns the configuration for the deletion confirmation dialog
 * @param templateName - The name of the template to be deleted
 */
export function getDeleteConfirmationConfig(templateName: string) {
  return {
    title: 'Supprimer le modèle',
    message: `Êtes-vous sûr de vouloir supprimer le modèle « ${templateName} » ?`,
    confirmText: 'Supprimer',
    cancelText: 'Annuler',
    confirmColor: 'warn' as const,
  };
}
