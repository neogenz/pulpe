import { z } from 'zod';

// Constants
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;
const MONTH_MIN = 1;
const MONTH_MAX = 12;
export const PAY_DAY_MIN = 1;
export const PAY_DAY_MAX = 31;

/**
 * ENUMS - Types métier selon SPECS.md section 2
 */

/**
 * TRANSACTION RECURRENCE - Fréquence des flux financiers
 *
 * UX Labels (CLAUDE.md frontend):
 * - 'fixed' → "Tous les mois" (récurrent mensuel)
 * - 'one_off' → "Une seule fois" (ponctuel)
 */
export const transactionRecurrenceSchema = z.enum(['fixed', 'one_off']);
export type TransactionRecurrence = z.infer<typeof transactionRecurrenceSchema>;

/**
 * TRANSACTION KIND - Types de flux financiers
 *
 * Selon SPECS.md section 2 "Types de Flux Financiers":
 * - 'income' : Entrée d'argent dans le budget mensuel
 * - 'expense' : Sortie d'argent du budget (hors épargne)
 * - 'saving' : Épargne - traitée comme expense pour forcer la budgétisation
 *
 * Note importante SPECS: "Le saving est volontairement traité comme une expense
 * dans les calculs pour forcer l'utilisateur à 'budgéter' son épargne"
 */
export const transactionKindSchema = z.enum(['income', 'expense', 'saving']);
export type TransactionKind = z.infer<typeof transactionKindSchema>;

export const priorityLevelSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type PriorityLevel = z.infer<typeof priorityLevelSchema>;

export const savingsGoalStatusSchema = z.enum([
  'ACTIVE',
  'COMPLETED',
  'PAUSED',
]);
export type SavingsGoalStatus = z.infer<typeof savingsGoalStatusSchema>;

/**
 * BUDGET - Instance mensuelle d'un template
 *
 * Selon SPECS.md section 2 "Concepts Métier":
 * - **Budget** : Instance mensuelle créée à partir d'un template, modifiable indépendamment
 * - Contient les Budget Lines (prévisions) et les Transactions (réelles)
 * - **ending_balance** : Stocké en base, calculé selon la formule SPECS
 * - Formule: ending_balance = (income + rollover) - (expenses + savings)
 *
 * Architecture de chaînage (SPECS section 3):
 * - Mois M+1 : rollover = ending_balance_from_M
 * - Premier mois : rollover = 0
 */
export const budgetSchema = z.object({
  id: z.uuid(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().max(500),
  userId: z.uuid().optional(),
  templateId: z.uuid(),
  // ending_balance : STOCKÉ en base selon SPECS.md section 3
  // Calculé par le backend, pas par le frontend
  endingBalance: z.number().nullable().optional(),
  // rollover : CALCULÉ par le backend, pas persisté en base
  // Report du mois précédent selon formule SPECS rollover_M = ending_balance_M-1
  rollover: z.number().optional(),
  // remaining : CALCULÉ par le backend pour la liste des budgets
  // Formule: remaining = (totalIncome + rollover) - totalExpenses - totalSavings
  // Correspond au "Disponible CHF" de la barre de progression
  remaining: z.number().optional(),
  // previousBudgetId : Budget source du rollover pour traçabilité
  previousBudgetId: z.uuid().nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Budget = z.infer<typeof budgetSchema>;

export const budgetCreateSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  description: z.string().max(500).trim().optional().default(''),
  templateId: z.uuid(),
});
export type BudgetCreate = z.infer<typeof budgetCreateSchema>;

// Schema for transactions during onboarding (without budgetId since budget doesn't exist yet)
export const onboardingTransactionSchema = z.object({
  amount: z.number().positive(),
  type: transactionKindSchema,
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  expenseType: transactionRecurrenceSchema,
  isRecurring: z.boolean(),
});

// Schema for creating template from onboarding data
export const budgetTemplateCreateFromOnboardingSchema = z.object({
  name: z.string().min(1).max(100).trim().default('Mois Standard'),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().default(true),
  monthlyIncome: z.number().min(0).default(0).optional(),
  housingCosts: z.number().min(0).default(0).optional(),
  healthInsurance: z.number().min(0).default(0).optional(),
  leasingCredit: z.number().min(0).default(0).optional(),
  phonePlan: z.number().min(0).default(0).optional(),
  transportCosts: z.number().min(0).default(0).optional(),
  customTransactions: z.array(onboardingTransactionSchema).default([]),
});
export type BudgetTemplateCreateFromOnboarding = z.infer<
  typeof budgetTemplateCreateFromOnboardingSchema
>;

export const budgetUpdateSchema = z.object({
  description: z.string().optional(),
  month: z.number().optional(),
  year: z.number().optional(),
});
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;

// Savings Goal schemas
/**
 * SAVINGS GOAL - Objectifs d'épargne
 *
 * ⚠️ FEATURE FUTURE - PAS DANS SPECS V1:
 * Cette entité n'est pas mentionnée dans SPECS.md V1.
 * SPECS indique: "Pas d'objectifs long terme : Focus sur le mois, pas de projections annuelles"
 *
 * STATUS: Préparation pour évolution future (hors V1)
 * IMPACT: Les BudgetLines ont un savingsGoalId pour cette feature future
 */
export const savingsGoalSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(100).trim(),
  targetAmount: z.number().positive(),
  targetDate: z.string(), // Date in ISO format
  priority: priorityLevelSchema,
  status: savingsGoalStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;

export const savingsGoalCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  targetAmount: z.number().positive(),
  targetDate: z.string(), // Date in ISO format
  priority: priorityLevelSchema,
  status: savingsGoalStatusSchema.default('ACTIVE'),
});
export type SavingsGoalCreate = z.infer<typeof savingsGoalCreateSchema>;

export const savingsGoalUpdateSchema = savingsGoalCreateSchema.partial();
export type SavingsGoalUpdate = z.infer<typeof savingsGoalUpdateSchema>;

/**
 * BUDGET LINE - Ligne budgétaire planifiée
 *
 * Selon SPECS.md section 2 "Concepts Métier":
 * - **Budget Line** : Ligne de budget PLANIFIÉE (income, expense ou saving)
 * - Représente ce qui est prévu/attendu dans le budget (ex: salaire mensuel, loyer)
 * - S'oppose aux **Transactions** qui sont les opérations RÉELLES saisies
 * - Peut provenir d'un template (templateLineId) ou être créée manuellement
 *
 * UX: Appelé "prévisions" dans l'interface utilisateur (voir CLAUDE.md frontend)
 */
export const budgetLineSchema = z.object({
  id: z.uuid(),
  budgetId: z.uuid(),
  templateLineId: z.uuid().nullable(),
  // NOTE: savingsGoalId pour feature future (pas dans SPECS V1)
  savingsGoalId: z.uuid().nullable(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  isManuallyAdjusted: z.boolean(),
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  // Rollover fields - added when budget line represents a rollover from previous month
  isRollover: z.boolean().optional(),
  rolloverSourceBudgetId: z.uuid().optional(),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

export const budgetLineCreateSchema = z.object({
  budgetId: z.uuid(),
  templateLineId: z.uuid().nullable().optional(),
  savingsGoalId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  isManuallyAdjusted: z.boolean().default(false),
  checkedAt: z.iso.datetime().nullable().optional(),
});
export type BudgetLineCreate = z.infer<typeof budgetLineCreateSchema>;

export const budgetLineUpdateSchema = budgetLineCreateSchema
  .omit({ budgetId: true })
  .partial()
  .extend({
    id: z.uuid(),
  });
export type BudgetLineUpdate = z.infer<typeof budgetLineUpdateSchema>;

/**
 * TRANSACTION - Opération réelle saisie par l'utilisateur
 *
 * Selon SPECS.md section 2 "Concepts Métier":
 * - **Transaction** : Opération RÉELLE saisie pour ajuster le budget par rapport au plan
 * - S'AJOUTE aux Budget Lines (ne les remplace pas) - voir RG-005
 * - Exemple: "Restaurant 45 CHF" vient s'ajouter aux dépenses prévues
 * - S'oppose aux **Budget Lines** qui sont les montants planifiés
 *
 * Formule SPECS: expenses = Σ(budget_lines) + Σ(transactions)
 */
/**
 * TRANSACTION - Opération réelle saisie par l'utilisateur
 *
 * budgetLineId: Optional allocation to a specific budget line
 * - When set, the transaction is "allocated" and contributes to that line's consumption
 * - When null, the transaction is "free" (contributes only to global budget)
 * - Validation: kind must match budget line's kind, budgetId must match
 */
export const transactionSchema = z.object({
  id: z.uuid(),
  budgetId: z.uuid(),
  budgetLineId: z.uuid().nullable(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  transactionDate: z.iso.datetime({ offset: true }),
  // NOTE: category pas définie dans SPECS V1 - "Pas de catégorisation avancée"
  category: z.string().max(100).trim().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionCreateSchema = z.object({
  budgetId: z.uuid(),
  budgetLineId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  transactionDate: z.iso.datetime({ offset: true }).optional(),
  category: z.string().max(100).trim().nullable().optional(),
  checkedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

export const transactionUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  kind: transactionKindSchema.optional(),
  transactionDate: z.iso.datetime({ offset: true }).optional(),
  category: z.string().max(100).trim().nullable().optional(),
});
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

/**
 * SEARCH RESULT - Unified search result for global search across budget items
 *
 * Supports both transactions and budget lines with a discriminator field:
 * - itemType: 'transaction' | 'budget_line'
 * - budgetName: Name of the parent budget
 * - year/month/monthLabel: Period info for breadcrumb display
 */
const searchItemTypeSchema = z.enum(['transaction', 'budget_line']);
export type SearchItemType = z.infer<typeof searchItemTypeSchema>;

export const transactionSearchResultSchema = z.object({
  id: z.uuid(),
  itemType: searchItemTypeSchema,
  name: z.string(),
  amount: z.number(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema.or(z.null()),
  transactionDate: z.iso.datetime({ offset: true }).or(z.null()),
  category: z.string().nullable(),
  budgetId: z.uuid(),
  budgetName: z.string(),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  monthLabel: z.string(),
});
export type TransactionSearchResult = z.infer<
  typeof transactionSearchResultSchema
>;

export const transactionSearchResultListSchema = z.array(
  transactionSearchResultSchema,
);
export type TransactionSearchResultList = z.infer<
  typeof transactionSearchResultListSchema
>;

export const transactionSearchResponseSchema = z.object({
  success: z.literal(true),
  data: transactionSearchResultListSchema,
});
export type TransactionSearchResponse = z.infer<
  typeof transactionSearchResponseSchema
>;

// Budget template schemas
export const budgetTemplateSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  userId: z.uuid().optional(),
  isDefault: z.boolean().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type BudgetTemplate = z.infer<typeof budgetTemplateSchema>;

// Template line schemas
export const templateLineSchema = z.object({
  id: z.uuid(),
  templateId: z.uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type TemplateLine = z.infer<typeof templateLineSchema>;

export const templateLineCreateSchema = z.object({
  templateId: z.uuid(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
});

// Template line create without templateId (for batch creation)
export const templateLineCreateWithoutTemplateIdSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
});
export type TemplateLineCreateWithoutTemplateId = z.infer<
  typeof templateLineCreateWithoutTemplateIdSchema
>;

// Budget template schemas (after template line schemas)
export const budgetTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().min(1).max(500).trim().optional(),
  isDefault: z.boolean().default(false),
  lines: z.array(templateLineCreateWithoutTemplateIdSchema).default([]),
});
export type BudgetTemplateCreate = z.infer<typeof budgetTemplateCreateSchema>;

// Schema for transactional template creation using RPC
export const budgetTemplateCreateTransactionalSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().default(false),
  lines: z.array(templateLineCreateWithoutTemplateIdSchema).default([]),
});
export type BudgetTemplateCreateTransactional = z.infer<
  typeof budgetTemplateCreateTransactionalSchema
>;

export const budgetTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().optional(),
});
export type BudgetTemplateUpdate = z.infer<typeof budgetTemplateUpdateSchema>;

// Template line update schema
export const templateLineUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  kind: transactionKindSchema.optional(),
  recurrence: transactionRecurrenceSchema.optional(),
  description: z.string().max(500).trim().optional(),
});
export type TemplateLineUpdate = z.infer<typeof templateLineUpdateSchema>;

// Bulk template line update schemas
export const templateLineUpdateWithIdSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  kind: transactionKindSchema.optional(),
  recurrence: transactionRecurrenceSchema.optional(),
  description: z.string().max(500).trim().optional(),
});
export type TemplateLineUpdateWithId = z.infer<
  typeof templateLineUpdateWithIdSchema
>;

export const templateLinesBulkUpdateSchema = z.object({
  lines: z.array(templateLineUpdateWithIdSchema).min(1),
});
export type TemplateLinesBulkUpdate = z.infer<
  typeof templateLinesBulkUpdateSchema
>;

// Extended bulk update schema supporting create, update, and delete operations
// Security: Limited to prevent DoS attacks and memory exhaustion
export const templateLinesBulkOperationsSchema = z
  .object({
    create: z
      .array(templateLineCreateWithoutTemplateIdSchema)
      .max(100)
      .default([]),
    update: z.array(templateLineUpdateWithIdSchema).max(100).default([]),
    delete: z.array(z.uuid()).max(100).default([]),
    propagateToBudgets: z.boolean().default(false),
  })
  .refine(
    (data) => {
      const totalOperations =
        data.create.length + data.update.length + data.delete.length;
      return totalOperations <= 200;
    },
    {
      error: 'Total bulk operations cannot exceed 200 items across all arrays',
      path: ['totalOperations'],
    },
  );
export type TemplateLinesBulkOperations = z.infer<
  typeof templateLinesBulkOperationsSchema
>;

// Response schema for bulk operations
const templateLinesPropagationSummarySchema = z.object({
  mode: z.enum(['template-only', 'propagate']),
  affectedBudgetIds: z.array(z.uuid()),
  affectedBudgetsCount: z.number().int().nonnegative(),
});
export type TemplateLinesPropagationSummary = z.infer<
  typeof templateLinesPropagationSummarySchema
>;

export const templateLinesBulkOperationsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    created: z.array(templateLineSchema),
    updated: z.array(templateLineSchema),
    deleted: z.array(z.uuid()),
    propagation: templateLinesPropagationSummarySchema.nullable().default(null),
  }),
});
export type TemplateLinesBulkOperationsResponse = z.infer<
  typeof templateLinesBulkOperationsResponseSchema
>;

// Template transaction update schema for backward compatibility
export const templateTransactionUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  type: transactionKindSchema.optional(),
  expenseType: transactionRecurrenceSchema.optional(),
  description: z.string().max(500).trim().optional(),
});

// Response schemas with proper typing
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string().optional(),
  details: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(), // Can be string or object
  code: z.string().optional(),
  statusCode: z.number().optional(),
  timestamp: z.string().optional(),
  path: z.string().optional(),
  method: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
  // Note: stack field from backend is intentionally not included as it's only for debugging
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export const deleteResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type DeleteResponse = z.infer<typeof deleteResponseSchema>;

// Specific response schemas for strict validation
export const budgetResponseSchema = z.object({
  success: z.literal(true),
  data: budgetSchema,
});
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;

export const budgetListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetSchema),
});
export type BudgetListResponse = z.infer<typeof budgetListResponseSchema>;

export const budgetDeleteResponseSchema = deleteResponseSchema;
export type BudgetDeleteResponse = z.infer<typeof budgetDeleteResponseSchema>;

// Budget summary schema with rollover calculations
export const budgetSummarySchema = z.object({
  endingBalance: z.number(),
  rollover: z.number(),
});
export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

// Budget details response schema - aggregates budget with its transactions and budget lines
export const budgetDetailsResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    budget: budgetSchema,
    transactions: z.array(transactionSchema),
    budgetLines: z.array(budgetLineSchema),
  }),
});
export type BudgetDetailsResponse = z.infer<typeof budgetDetailsResponseSchema>;

// Budget with full details for export (includes rollover, remaining, transactions, budgetLines)
export const budgetWithDetailsSchema = budgetSchema.extend({
  rollover: z.number(),
  remaining: z.number(),
  previousBudgetId: z.string().uuid().nullable(),
  transactions: z.array(transactionSchema),
  budgetLines: z.array(budgetLineSchema),
});
export type BudgetWithDetails = z.infer<typeof budgetWithDetailsSchema>;

// Export response schema for bulk budget export
export const budgetExportResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    exportDate: z.string(),
    totalBudgets: z.number().int().nonnegative(),
    budgets: z.array(budgetWithDetailsSchema),
  }),
});
export type BudgetExportResponse = z.infer<typeof budgetExportResponseSchema>;

/**
 * SPARSE FIELDSETS - Optimized budget queries
 *
 * Allows clients to request only specific fields from the budgets endpoint,
 * reducing payload size from ~50KB to ~500 bytes for dashboard use cases.
 *
 * JSON:API standard: https://jsonapi.org/format/#fetching-sparse-fieldsets
 */

// Available fields that can be requested via sparse fieldsets
export const VALID_SPARSE_FIELDS = [
  'month',
  'year',
  'totalExpenses',
  'totalSavings',
  'totalIncome',
  'remaining',
  'rollover',
] as const;
export const budgetFieldsEnum = z.enum(VALID_SPARSE_FIELDS);
export type BudgetField = z.infer<typeof budgetFieldsEnum>;

// Query parameters for sparse fieldsets
export const listBudgetsQuerySchema = z.object({
  fields: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const requestedFields = val.split(',').map((f) => f.trim());
        return requestedFields.every((f) =>
          (VALID_SPARSE_FIELDS as readonly string[]).includes(f),
        );
      },
      {
        message: `Invalid fields. Valid options: ${VALID_SPARSE_FIELDS.join(', ')}`,
      },
    ),
  limit: z.coerce.number().int().min(1).max(36).optional(),
  year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
});
export type ListBudgetsQuery = z.infer<typeof listBudgetsQuerySchema>;

// Sparse budget response with optional aggregate fields
export const budgetSparseSchema = z.object({
  id: z.uuid(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX).optional(),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
  totalExpenses: z.number().optional(),
  totalSavings: z.number().optional(),
  totalIncome: z.number().optional(),
  remaining: z.number().optional(),
  rollover: z.number().optional(),
});
export type BudgetSparse = z.infer<typeof budgetSparseSchema>;

// Response wrapper for sparse budget list
export const budgetSparseListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetSparseSchema),
});
export type BudgetSparseListResponse = z.infer<
  typeof budgetSparseListResponseSchema
>;

// Transaction response schemas for operation-specific types
export const transactionResponseSchema = z.object({
  success: z.literal(true),
  data: transactionSchema,
});
export type TransactionCreateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionUpdateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionFindOneResponse = z.infer<
  typeof transactionResponseSchema
>;

export const transactionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(transactionSchema),
});
export type TransactionListResponse = z.infer<
  typeof transactionListResponseSchema
>;

export const transactionDeleteResponseSchema = deleteResponseSchema;
export type TransactionDeleteResponse = z.infer<
  typeof transactionDeleteResponseSchema
>;

// Budget template response schemas
export const budgetTemplateResponseSchema = z.object({
  success: z.literal(true),
  data: budgetTemplateSchema,
});
export type BudgetTemplateResponse = z.infer<
  typeof budgetTemplateResponseSchema
>;

export const budgetTemplateListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetTemplateSchema),
});
export type BudgetTemplateListResponse = z.infer<
  typeof budgetTemplateListResponseSchema
>;

export const budgetTemplateDeleteResponseSchema = deleteResponseSchema;
export type BudgetTemplateDeleteResponse = z.infer<
  typeof budgetTemplateDeleteResponseSchema
>;

// Response schema for template creation that includes created lines
export const budgetTemplateCreateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    template: budgetTemplateSchema,
    lines: z.array(templateLineSchema),
  }),
});
export type BudgetTemplateCreateResponse = z.infer<
  typeof budgetTemplateCreateResponseSchema
>;

// Response schema for template usage check
export const templateUsageResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    isUsed: z.boolean(),
    budgetCount: z.number(),
    budgets: z.array(
      z.object({
        id: z.string(),
        month: z.number().min(MONTH_MIN).max(MONTH_MAX),
        year: z.number().min(MIN_YEAR).max(MAX_YEAR),
        description: z.string(),
      }),
    ),
  }),
});
export type TemplateUsageResponse = z.infer<typeof templateUsageResponseSchema>;

// Response schema for transactional RPC function
export const budgetTemplateCreateTransactionalResponseSchema = z.object({
  success: z.literal(true),
  template: budgetTemplateSchema,
  lines_created: z.number(),
});
export type BudgetTemplateCreateTransactionalResponse = z.infer<
  typeof budgetTemplateCreateTransactionalResponseSchema
>;

// Template line response schemas
export const templateLineResponseSchema = z.object({
  success: z.literal(true),
  data: templateLineSchema,
});
export type TemplateLineResponse = z.infer<typeof templateLineResponseSchema>;

export const templateLineListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(templateLineSchema),
});
export type TemplateLineListResponse = z.infer<
  typeof templateLineListResponseSchema
>;

export const templateLinesBulkUpdateResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(templateLineSchema),
  message: z.string().optional(),
});
export type TemplateLinesBulkUpdateResponse = z.infer<
  typeof templateLinesBulkUpdateResponseSchema
>;

export const templateLineDeleteResponseSchema = deleteResponseSchema;
export type TemplateLineDeleteResponse = z.infer<
  typeof templateLineDeleteResponseSchema
>;

// Generic transaction response type - prefer operation-specific types above
export type TransactionResponse = {
  success: true;
  data?: Transaction | Transaction[];
};

// User schemas
/**
 * PAY DAY OF MONTH - Jour de début de mois budgétaire
 *
 * Permet de définir le jour où commence un nouveau mois budgétaire,
 * typiquement basé sur le jour de réception du salaire.
 *
 * Exemple: payDayOfMonth = 27
 * - Le 26 décembre → mois budgétaire de décembre
 * - Le 27 décembre → mois budgétaire de janvier
 *
 * Si null ou undefined: comportement calendaire standard (1er du mois)
 */
export const payDayOfMonthSchema = z
  .number()
  .int()
  .min(PAY_DAY_MIN)
  .max(PAY_DAY_MAX)
  .nullable()
  .optional();
export type PayDayOfMonth = z.infer<typeof payDayOfMonthSchema>;

export const userProfileSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  payDayOfMonth: payDayOfMonthSchema,
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).trim(),
  lastName: z.string().min(1).max(50).trim(),
});
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

/**
 * Schema pour mettre à jour les préférences utilisateur
 */
export const updateUserSettingsSchema = z.object({
  payDayOfMonth: z
    .number()
    .int()
    .min(PAY_DAY_MIN)
    .max(PAY_DAY_MAX)
    .nullable()
    .optional(),
});
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

export const userSettingsSchema = z.object({
  payDayOfMonth: payDayOfMonthSchema,
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const userSettingsResponseSchema = z.object({
  success: z.literal(true),
  data: userSettingsSchema,
});
export type UserSettingsResponse = z.infer<typeof userSettingsResponseSchema>;

export const userProfileResponseSchema = z.object({
  success: z.literal(true),
  user: userProfileSchema,
});
export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

export const publicInfoResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  authenticated: z.boolean(),
});
export type PublicInfoResponse = z.infer<typeof publicInfoResponseSchema>;

export const onboardingStatusResponseSchema = z.object({
  success: z.literal(true),
  onboardingCompleted: z.boolean(),
});
export type OnboardingStatusResponse = z.infer<
  typeof onboardingStatusResponseSchema
>;

export const successMessageResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
export type SuccessMessageResponse = z.infer<
  typeof successMessageResponseSchema
>;

export const deleteAccountResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  scheduledDeletionAt: z.iso.datetime({ offset: true }),
});
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;

// Savings Goal response schemas
export const savingsGoalResponseSchema = z.object({
  success: z.literal(true),
  data: savingsGoalSchema,
});
export type SavingsGoalResponse = z.infer<typeof savingsGoalResponseSchema>;

export const savingsGoalListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(savingsGoalSchema),
});
export type SavingsGoalListResponse = z.infer<
  typeof savingsGoalListResponseSchema
>;

export const savingsGoalDeleteResponseSchema = deleteResponseSchema;
export type SavingsGoalDeleteResponse = z.infer<
  typeof savingsGoalDeleteResponseSchema
>;

// Budget Line response schemas
export const budgetLineResponseSchema = z.object({
  success: z.literal(true),
  data: budgetLineSchema,
});
export type BudgetLineResponse = z.infer<typeof budgetLineResponseSchema>;

export const budgetLineListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(budgetLineSchema),
});
export type BudgetLineListResponse = z.infer<
  typeof budgetLineListResponseSchema
>;

export const budgetLineDeleteResponseSchema = deleteResponseSchema;
export type BudgetLineDeleteResponse = z.infer<
  typeof budgetLineDeleteResponseSchema
>;

// Auth schemas
export const userInfoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
});
export type UserInfo = z.infer<typeof userInfoSchema>;

export const authLoginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});
export type AuthLogin = z.infer<typeof authLoginSchema>;

export const authLoginResponseSchema = z.object({
  success: z.literal(true),
  user: userInfoSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthLoginResponse = z.infer<typeof authLoginResponseSchema>;

export const authValidationResponseSchema = z.object({
  success: z.literal(true),
  user: userInfoSchema,
});
export type AuthValidationResponse = z.infer<
  typeof authValidationResponseSchema
>;

export const authErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});
export type AuthErrorResponse = z.infer<typeof authErrorResponseSchema>;

// Demo mode schemas
export const demoSessionCreateSchema = z.object({
  turnstileToken: z.string(),
});
export type DemoSessionCreate = z.infer<typeof demoSessionCreateSchema>;

export const demoSessionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    session: z.object({
      access_token: z.string(),
      token_type: z.string(),
      expires_in: z.number(),
      expires_at: z.number(),
      refresh_token: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        created_at: z.string(),
      }),
    }),
  }),
  message: z.string(),
});
export type DemoSessionResponse = z.infer<typeof demoSessionResponseSchema>;

export const demoCleanupResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    deleted: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  message: z.string(),
});
export type DemoCleanupResponse = z.infer<typeof demoCleanupResponseSchema>;
