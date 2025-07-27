/**
 * Constants for budget creation feature
 * Shared between components and services to maintain consistency
 */
export const BUDGET_CREATION_CONSTANTS = {
  // Form validation constraints
  DESCRIPTION_MAX_LENGTH: 100,
  DESCRIPTION_MIN_LENGTH: 1,

  // Template display limits
  TEMPLATE_SEARCH_DEBOUNCE_TIME: 300,
  MAX_TEMPLATES_TO_DISPLAY: 50,

  // Date constraints
  MAX_FUTURE_YEARS: 2,

  // UI configuration
  TEMPLATE_CARD_MIN_HEIGHT: '250px',
  TEMPLATE_CARD_MAX_HEIGHT: '350px',

  // Loading timeouts
  TEMPLATE_LOADING_TIMEOUT: 5000,

  // Error messages
  ERROR_MESSAGES: {
    TEMPLATE_NOT_FOUND: 'Template introuvable ou accès non autorisé',
    BUDGET_ALREADY_EXISTS: 'Un budget existe déjà pour cette période',
    INVALID_DESCRIPTION: 'La description est requise',
    DESCRIPTION_TOO_LONG: 'La description ne peut pas dépasser 100 caractères',
    INVALID_DATE: "Le mois et l'année sont requis",
    TEMPLATE_REQUIRED: 'Veuillez sélectionner un template',
    GENERIC_ERROR: "Une erreur inattendue s'est produite",
  } as const,

  // Success messages
  SUCCESS_MESSAGES: {
    BUDGET_CREATED: 'Budget créé avec succès !',
  } as const,
} as const;

/**
 * Type-safe access to error messages
 */
export type BudgetCreationErrorMessage =
  (typeof BUDGET_CREATION_CONSTANTS.ERROR_MESSAGES)[keyof typeof BUDGET_CREATION_CONSTANTS.ERROR_MESSAGES];

/**
 * Type-safe access to success messages
 */
export type BudgetCreationSuccessMessage =
  (typeof BUDGET_CREATION_CONSTANTS.SUCCESS_MESSAGES)[keyof typeof BUDGET_CREATION_CONSTANTS.SUCCESS_MESSAGES];
