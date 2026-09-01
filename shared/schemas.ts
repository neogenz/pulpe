import * as z from 'zod';
import {
  createSuccessResponse,
  createListResponse,
} from './src/api-response.js';

// Constants
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;
const MAX_YEAR = CURRENT_YEAR + 10;
const MONTHS_PER_YEAR = 12;
const MONTH_MIN = 1;
const MONTH_MAX = MONTHS_PER_YEAR;
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

export const supportedCurrencySchema = z.enum(['CHF', 'EUR']);
export type SupportedCurrency = z.infer<typeof supportedCurrencySchema>;
export const SUPPORTED_CURRENCIES: readonly SupportedCurrency[] =
  supportedCurrencySchema.options;

/**
 * UI languages Pulpe ships. ISO 639-1 codes only, never a regional variant:
 * the region already comes from the currency (`CHF` → `de-CH`, `EUR` → `fr-FR`),
 * and a `de-CH` here would create a second, contradictory regional axis.
 * A browser reporting `de-CH` collapses to `de`.
 */
export const supportedLocaleSchema = z.enum(['fr', 'en', 'de', 'it']);
export type SupportedLocale = z.infer<typeof supportedLocaleSchema>;
export const SUPPORTED_LOCALES: readonly SupportedLocale[] =
  supportedLocaleSchema.options;

export const currencyRateQuerySchema = z.object({
  base: supportedCurrencySchema,
  target: supportedCurrencySchema,
});
export type CurrencyRateQuery = z.infer<typeof currencyRateQuerySchema>;

export const currencyRateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    base: supportedCurrencySchema,
    target: supportedCurrencySchema,
    rate: z.number().positive(),
    date: z.iso.date(),
  }),
});
export type CurrencyRateResponse = z.infer<typeof currencyRateResponseSchema>;

/**
 * DUAL-READ NUMERIC WIRE FORMAT — exchange_rate
 *
 * exchange_rate is NUMERIC(18,8) in Postgres; PostgREST emits it as a string
 * so full precision survives JSON (IEEE-754 would truncate beyond ~15 digits).
 * Clients write it as a number (frontend) or string (iOS during migration).
 *
 * The union narrowing (`number | string` only) prevents JS Number() semantics
 * from silently turning booleans (true → 1) or single-element arrays
 * ([1.2] → 1.2) into valid financial values — which z.coerce.number() would.
 * Infinity and -Infinity are rejected on both branches.
 */
export const exchangeRateWire = z.union([
  z.number().finite(),
  z.string().transform((value, ctx) => {
    if (value.trim() === '') {
      ctx.addIssue({
        code: 'custom',
        message: 'Exchange rate must not be empty',
      });
      return z.NEVER;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Exchange rate must be a finite number',
      });
      return z.NEVER;
    }
    return parsed;
  }),
]);

export const exchangeRateWirePositive = exchangeRateWire.pipe(
  z.number().positive(),
);

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
  endingBalance: z.coerce.number().nullable().optional(),
  // rollover : CALCULÉ par le backend, pas persisté en base
  // Report du mois précédent selon formule SPECS rollover_M = ending_balance_M-1
  rollover: z.number().optional(),
  // remaining : CALCULÉ par le backend pour la liste des budgets
  // Formule: remaining = (totalIncome + rollover) - totalExpenses
  // totalExpenses inclut les savings via la logique d'enveloppe
  // Correspond au "Disponible CHF" de la barre de progression
  remaining: z.number().optional(),
  // previousBudgetId : Budget source du rollover pour traçabilité
  previousBudgetId: z.uuid().nullable().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Budget = z.infer<typeof budgetSchema>;

export const budgetCreateSchema = z.strictObject({
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
export const budgetTemplateCreateFromOnboardingSchema = z.strictObject({
  name: z.string().min(1).max(100).trim().default('Mois Standard'),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().default(true),
  locale: supportedLocaleSchema.optional(),
  monthlyIncome: z.number().min(0).default(0).optional(),
  housingCosts: z.number().min(0).default(0).optional(),
  healthInsurance: z.number().min(0).default(0).optional(),
  leasingCredit: z.number().min(0).default(0).optional(),
  phonePlan: z.number().min(0).default(0).optional(),
  internetPlan: z.number().min(0).default(0).optional(),
  transportCosts: z.number().min(0).default(0).optional(),
  customTransactions: z.array(onboardingTransactionSchema).max(50).default([]),
});
export type BudgetTemplateCreateFromOnboarding = z.infer<
  typeof budgetTemplateCreateFromOnboardingSchema
>;

export const budgetUpdateSchema = z.strictObject({
  description: z.string().optional(),
  month: z.number().optional(),
  year: z.number().optional(),
});
export type BudgetUpdate = z.infer<typeof budgetUpdateSchema>;

const MAX_GENERATE_COUNT = 36;
const DEFAULT_GENERATE_COUNT = 12;

/** Schema for bulk-generating consecutive monthly budgets from a template */
export const budgetGenerateSchema = z.strictObject({
  templateId: z.uuid(),
  startMonth: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  startYear: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  count: z
    .number()
    .int()
    .min(1)
    .max(MAX_GENERATE_COUNT)
    .default(DEFAULT_GENERATE_COUNT),
});
export type BudgetGenerate = z.infer<typeof budgetGenerateSchema>;

/** Response for budget generation: created budgets + skipped months */
export const budgetGenerateResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    budgets: z.array(budgetSchema),
    skippedMonths: z.array(
      z.object({
        month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
        year: z.number().int().min(MIN_YEAR),
      }),
    ),
  }),
});
export type BudgetGenerateResponse = z.infer<
  typeof budgetGenerateResponseSchema
>;

// Savings Goal schemas
/**
 * SAVINGS GOAL - Objectifs d'épargne (PUL-98)
 *
 * Livré : CRUD + tagging des prévisions Épargne (PUL-12), progression
 * prévu/confirmé (PUL-8). Source de vérité métier : docs/SAVINGS.md.
 * Le lien vit sur template_line (modèle, survit aux régénérations) et
 * budget_line (mois effectif) — jamais sur transaction.
 */
export const savingsGoalSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string().min(1).max(100).trim(),
  startDate: z.iso.date().nullable().default(null),
  // coerce: Supabase PostgREST returns numeric(12,2) columns as strings
  targetAmount: z.coerce.number().nonnegative().nullable(),
  targetDate: z.iso.date().nullable(), // ISO date (YYYY-MM-DD)
  status: savingsGoalStatusSchema,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  originalTargetAmount: z.coerce.number().nonnegative().nullable().optional(),
  originalCurrency: supportedCurrencySchema.nullable().optional(),
  targetCurrency: supportedCurrencySchema.nullable().optional(),
  exchangeRate: exchangeRateWire.nullable().optional(),
  /** Montant déjà épargné avant le suivi (stock one-shot), chiffré en base. */
  initialAmount: z.coerce.number().nonnegative().nullable().optional(),
});
export type SavingsGoal = z.infer<typeof savingsGoalSchema>;

/** Mois courant inclus : l'échéance maximale est la 120e période. */
export const MAX_SAVINGS_GOAL_PLAN_PERIODS = 120;

/**
 * Décision explicite sur les prévisions devenues hors horizon. Le même contrat
 * sert à l'arrêt de génération et à l'avancement atomique d'une échéance.
 */
export const savingsGoalReconciliationSchema = z
  .strictObject({
    mode: z.enum(['freeze', 'remove']),
    budgetLineIds: z.array(z.uuid()).min(1),
  })
  .refine(
    (value) => new Set(value.budgetLineIds).size === value.budgetLineIds.length,
    { error: 'Une prévision apparaît deux fois dans la décision.' },
  );
export type SavingsGoalReconciliation = z.infer<
  typeof savingsGoalReconciliationSchema
>;

function isWithinSavingsGoalPlanHorizon(value: string): boolean {
  const [year, month] = value.split('-').map(Number);
  const now = new Date();
  const currentPeriodIndex = now.getFullYear() * 12 + now.getMonth() + 1;
  const targetPeriodIndex = year * 12 + month;
  return (
    targetPeriodIndex <= currentPeriodIndex + MAX_SAVINGS_GOAL_PLAN_PERIODS - 1
  );
}

export const savingsGoalCreateSchema = z
  .strictObject({
    name: z.string().min(1).max(100).trim(),
    startDate: z.iso.date().optional(),
    targetAmount: z.number().positive().optional(),
    // z.iso.date() + refine ≥ today. NOT .min() — in Zod 4, .min() on an ISO
    // string measures LENGTH, not the date. ISO 'YYYY-MM-DD' strings compare
    // lexicographically === chronologically, so a string compare is correct.
    targetDate: z.iso
      .date()
      .refine((value) => value >= new Date().toISOString().slice(0, 10), {
        error: 'Target date cannot be in the past',
      })
      .refine(isWithinSavingsGoalPlanHorizon, {
        error: 'Target date exceeds the 120-period planning horizon',
      })
      .optional(),
    status: savingsGoalStatusSchema.default('ACTIVE'),
    /**
     * Opt-in auto-décomposition : une échéance produit des prévisions `one_off`
     * bornées ; sans échéance, le serveur crée une récurrence liée dans le Mois
     * Type. Le client ne suggère un montant qu'avec cible + échéance.
     */
    monthlyContribution: z.number().positive().optional(),
    originalTargetAmount: z.number().positive().optional(),
    originalCurrency: supportedCurrencySchema.optional(),
    targetCurrency: supportedCurrencySchema.optional(),
    exchangeRate: exchangeRateWirePositive.optional(),
    /** Montant déjà épargné avant le suivi (stock one-shot). Omis = 0. */
    initialAmount: z.number().nonnegative().optional(),
  })
  .superRefine(({ startDate, targetDate }, context) => {
    if (startDate != null && targetDate != null && startDate > targetDate) {
      context.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'Start date cannot be after target date',
      });
    }
  });
export type SavingsGoalCreate = z.infer<typeof savingsGoalCreateSchema>;

export const savingsGoalUpdateSchema = z
  .strictObject({
    name: z.string().min(1).max(100).trim().optional(),
    startDate: z.iso.date().nullable().optional(),
    targetAmount: z.number().positive().nullable().optional(),
    targetDate: z
      .union([
        z.iso.date().refine(isWithinSavingsGoalPlanHorizon, {
          error: 'Target date exceeds the 120-period planning horizon',
        }),
        z.null(),
      ])
      .optional(),
    status: savingsGoalStatusSchema.optional(),
    originalTargetAmount: z.number().positive().optional(),
    originalCurrency: supportedCurrencySchema.optional(),
    targetCurrency: supportedCurrencySchema.optional(),
    exchangeRate: exchangeRateWirePositive.optional(),
    /** Omis = inchangé ; `0` efface le montant de départ. */
    initialAmount: z.number().nonnegative().optional(),
    reconciliation: savingsGoalReconciliationSchema.optional(),
  })
  .superRefine(({ startDate, targetDate }, context) => {
    if (startDate != null && targetDate != null && startDate > targetDate) {
      context.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: 'Start date cannot be after target date',
      });
    }
  });
export type SavingsGoalUpdate = z.infer<typeof savingsGoalUpdateSchema>;

// Tag schemas (PUL-18)
/**
 * TAG - Étiquette utilisateur pour classifier les dépenses
 *
 * Remplace le champ libre `transaction.category` par une métadonnée plaintext
 * structurée. Le nom est unique par utilisateur sans distinction de casse côté
 * DB; les junctions rattachent les tags aux transactions et aux prévisions.
 */
export const MAX_TAGS_PER_TRANSACTION = 10;

function hasUniqueTagIds(tagIds: readonly string[]): boolean {
  return new Set(tagIds).size === tagIds.length;
}

export const tagSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  // trim AVANT min/max : sinon " " passe min(1) puis devient "" et viole le
  // CHECK DB (char_length >= 1) → 500 au lieu d'un 400 de validation
  name: z.string().trim().min(1).max(30),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type Tag = z.infer<typeof tagSchema>;

export const tagCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(30),
});
export type TagCreate = z.infer<typeof tagCreateSchema>;

export const tagUpdateSchema = tagCreateSchema.partial();
export type TagUpdate = z.infer<typeof tagUpdateSchema>;

export const tagHistoryMonthsSchema = z.coerce
  .number()
  .pipe(z.union([z.literal(3), z.literal(6), z.literal(12), z.literal(24)]));
export type TagHistoryMonths = z.infer<typeof tagHistoryMonthsSchema>;

export const tagHistoryQuerySchema = z
  .strictObject({
    months: tagHistoryMonthsSchema,
    endMonth: z.coerce.number().int().min(MONTH_MIN).max(MONTH_MAX),
    endYear: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR),
  })
  .refine(
    ({ months, endMonth, endYear }) =>
      (endYear - MIN_YEAR) * MONTHS_PER_YEAR + endMonth - months >= 0,
    {
      error: `History window cannot start before ${MIN_YEAR}`,
      path: ['endYear'],
    },
  );
export type TagHistoryQuery = z.infer<typeof tagHistoryQuerySchema>;

export const tagHistoryMonthSchema = z.object({
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  plannedAmount: z.number().finite().nonnegative(),
  actualAmount: z.number().finite().nonnegative(),
});
export type TagHistoryMonth = z.infer<typeof tagHistoryMonthSchema>;

export const tagHistorySchema = z.object({
  tagId: z.uuid(),
  periods: z.array(tagHistoryMonthSchema),
  totalPlanned: z.number().finite().nonnegative(),
  totalActual: z.number().finite().nonnegative(),
  monthlyAverageActual: z.number().finite().nonnegative(),
  actualToPlannedPercent: z.number().finite().nonnegative().nullable(),
});
export type TagHistory = z.infer<typeof tagHistorySchema>;

/**
 * SAVINGS GOAL PROGRESS - Progression d'un objectif (PUL-8)
 *
 * Deux couches (docs/SAVINGS.md §4/§5) :
 * - `plannedCumulative` : engagement — Σ `line.amount` BRUT des prévisions
 *   Épargne liées des mois écoulés/en cours (pas d'enveloppe transactions).
 * - `confirmed` : réalité pointée — enveloppe checked-only (`checkedAt`),
 *   TOUS les mois (le pointage anticipé d'un mois futur compte), PLUS
 *   `initialAmount` (stock de départ). `confirmedPace`/`cumulativeGap`
 *   restent des mesures de FLUX et excluent ce stock.
 *
 * `achievementPercent` et `suggestCompletion` (D2) portent EXCLUSIVEMENT sur
 * le confirmé — jamais le prévu. La projection (`projected`) ajoute au confirmé
 * le reliquat planifié courant/futur jusqu'à l'échéance ; `paceStatus` compare
 * ce solde projeté à la cible. `confirmedPace` reste une mesure du rythme réel.
 *
 * D1 échéance dépassée (`monthsRemaining ≤ 0`, exposé via `isOverdue`) :
 * `required` et `paceStatus` sont `null`, `projected = confirmed` — état
 * factuel, jamais un `behind` générique. `PAUSED` ⇒ `paceStatus = null`.
 * Le serveur calcule tout (payDay-aware, montants déchiffrés) ; les clients
 * n'implémentent AUCUNE formule.
 */
export const savingsGoalPaceStatusSchema = z.enum([
  'behind',
  'on_track',
  'ahead',
]);
export type SavingsGoalPaceStatus = z.infer<typeof savingsGoalPaceStatusSchema>;

/** Période budgétaire nue `{ month, year }` (payDay-aware côté serveur). */
export const budgetPeriodSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
});
export type BudgetPeriodWire = z.infer<typeof budgetPeriodSchema>;

/** État d'un mois de la timeline du plan (docs/SAVINGS.md §10.2). */
export const savingsPlanMonthStateSchema = z.enum([
  'past',
  'current',
  'future',
  'gap',
]);
export type SavingsPlanMonthState = z.infer<typeof savingsPlanMonthStateSchema>;

/**
 * Un mois de la timeline d'un objectif (docs/SAVINGS.md §10.2). Alimente le
 * chart trajectoire (A), le calendrier mensuel (B) et rebase le simulateur (C).
 */
export const savingsGoalPlanMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  state: savingsPlanMonthStateSchema,
  isLocked: z.boolean(),
  /** False pour les rows conservées avant le début effectif de contribution. */
  isContributionEligible: z.boolean().optional(),
  /** Distingue un budget matérialisé d'une période encore sans budget. */
  hasBudget: z.boolean().optional(),
  isProvisionable: z.boolean().optional(),
  plannedAmount: z.number(),
  confirmedAmount: z.number(),
  /** Σ des retraits du mois (§11) — creuse les cumuls, jamais la contribution. */
  withdrawnAmount: z.number().optional(),
  /** Σ BRUTE des retraits ANNONCÉS du mois (§12) — affichage seul. */
  plannedWithdrawalAmount: z.number().optional(),
  /** Part de ces annonces encore à sortir — c'est elle que les cumuls retranchent. */
  remainingPlannedWithdrawalAmount: z.number().optional(),
  /** Part issue directement du plan, sans Prévision Revenu dans un budget. */
  planOnlyWithdrawalAmount: z.number().nonnegative().optional(),
  /** Part issue du plan sous forme de Prévision Revenu liée. */
  planLinkedWithdrawalAmount: z.number().nonnegative().optional(),
  /** Destination du retrait piloté par le plan, conservée lors d'une édition. */
  planWithdrawalDestination: z.enum(['goal_only', 'linked_income']).optional(),
  /** Part de la Prévision Revenu liée déjà réalisée. */
  planWithdrawalConsumedAmount: z.number().nonnegative().optional(),
  plannedCumulative: z.number(),
  confirmedCumulative: z.number(),
  /** Solde attendu fin de mois si le plan se déroule tel quel (§12). */
  projectedCumulative: z.number().optional(),
  lines: z.array(
    z.object({
      budgetLineId: z.uuid(),
      amount: z.number(),
      checkedAt: z.iso.datetime({ offset: true }).nullable(),
      isManuallyAdjusted: z.boolean(),
    }),
  ),
});
export type SavingsGoalPlanMonth = z.infer<typeof savingsGoalPlanMonthSchema>;

export const savingsGoalProgressSchema = z.object({
  goalId: z.uuid(),
  status: savingsGoalStatusSchema,
  startDate: z.iso.date().nullable().default(null),
  targetAmount: z.number().nonnegative().nullable(),
  targetDate: z.iso.date().nullable(),
  plannedCumulative: z.number(),
  plannedProjection: z.number(),
  confirmed: z.number(),
  achievementPercent: z.number().int().min(0).max(100).nullable(),
  monthsElapsed: z.number().int().min(1),
  // Mois courant ET mois d'échéance inclus ; ≤ 0 ⇒ échéance dépassée (D1).
  monthsRemaining: z.number().int().nullable(),
  isOverdue: z.boolean(),
  pace: z.number(),
  confirmedPace: z.number(),
  required: z.number().nullable(),
  projected: z.number().nullable(),
  paceStatus: savingsGoalPaceStatusSchema.nullable(),
  // D2 — suggestion « marquer terminé ? ». Jamais d'auto-flip côté serveur.
  suggestCompletion: z.boolean().nullable(),
  linkedLineCount: z.number().int().min(0),
  // Formule 10 — écart cumulé (prévu − confirmé), signé, jamais clampé.
  cumulativeGap: z.number(),
  // Date d'atteinte estimée au rythme confirmé (docs/SAVINGS.md §10.2).
  estimatedCompletion: budgetPeriodSchema.nullable(),
  // Montant de départ (stock, inclus dans confirmed) — default 0 pour les
  // payloads/mocks existants qui ne portent pas encore le champ.
  initialAmount: z.number().nonnegative().default(0),
  // Timeline ancrage → cible (chart A + calendrier B + rebase simulateur C).
  months: z.array(savingsGoalPlanMonthSchema),
  // FX door-keepers (CA6) — devise du compte uniquement en v1, toujours null.
  originalTargetAmount: z.number().nullable(),
  originalCurrency: supportedCurrencySchema.nullable(),
  targetCurrency: supportedCurrencySchema.nullable(),
  exchangeRate: z.number().nullable(),
});
export type SavingsGoalProgress = z.infer<typeof savingsGoalProgressSchema>;

/** Compatibilité des consommateurs existants du contrat d'application. */
export const MAX_PLAN_ADJUSTMENTS = MAX_SAVINGS_GOAL_PLAN_PERIODS;

/**
 * Requête d'application d'un plan simulé (`POST /savings-goals/:id/plan`,
 * docs/SAVINGS.md §10.4). `monthAdjustments` = budgets matérialisés ;
 * `missingMonthAdjustments` = périodes sans Prévision liée, budget absent ou
 * déjà matérialisé.
 */
export const savingsGoalPlanApplySchema = z
  .strictObject({
    monthAdjustments: z
      .array(
        z.strictObject({
          budgetLineId: z.uuid(),
          amount: z.number().nonnegative(),
        }),
      )
      .max(MAX_PLAN_ADJUSTMENTS)
      .default([]),
    missingMonthAdjustments: z
      .array(
        z.strictObject({
          month: z.number().int().min(1).max(12),
          year: z.number().int(),
          /**
           * Zéro toléré, jamais provisionné. Les clients publiés avant PUL-316
           * envoient 0 sur un mois trou (« Réajuster la suite » quand la cible
           * est déjà atteinte), et le backend se déploie avant qu'ils soient
           * mis à jour : refuser ici rejetterait tout le plan, y compris ses
           * ajustements valides. Le use case laisse tomber ces entrées.
           */
          amount: z.number().nonnegative(),
        }),
      )
      .max(MAX_PLAN_ADJUSTMENTS)
      .default([]),
    /**
     * Mouvements négatifs conservés dans l'objectif, sans budget. Le montant
     * reste signé sur le wire pour ne jamais confondre une sortie avec une
     * contribution ; zéro supprime l'ajustement existant.
     */
    planWithdrawalAdjustments: z
      .array(
        z.strictObject({
          month: z.number().int().min(1).max(12),
          year: z.number().int(),
          amount: z.number().max(0),
          /** Absence = comportement historique « objectif uniquement ». */
          destination: z.enum(['goal_only', 'linked_income']).optional(),
        }),
      )
      .max(MAX_PLAN_ADJUSTMENTS)
      .default([]),
  })
  .refine(
    (value) =>
      value.monthAdjustments.length +
        value.missingMonthAdjustments.length +
        value.planWithdrawalAdjustments.length >
      0,
    { error: 'Le plan est vide.' },
  )
  .refine(
    (value) =>
      new Set(value.monthAdjustments.map((item) => item.budgetLineId)).size ===
      value.monthAdjustments.length,
    { error: 'Une prévision apparaît deux fois dans le plan.' },
  )
  .refine(
    (value) => {
      const periods = value.missingMonthAdjustments.map(
        (item) => `${item.year}-${item.month}`,
      );
      return new Set(periods).size === periods.length;
    },
    { error: 'Une période absente apparaît deux fois dans le plan.' },
  )
  .refine(
    (value) => {
      const periods = value.planWithdrawalAdjustments.map(
        (item) => `${item.year}-${item.month}`,
      );
      return new Set(periods).size === periods.length;
    },
    { error: 'Un retrait du plan apparaît deux fois sur la même période.' },
  );
type ParsedSavingsGoalPlanApply = z.infer<typeof savingsGoalPlanApplySchema>;
/** Type d'entrée; le schéma complète la jambe absente avec un tableau vide. */
export type SavingsGoalPlanApply = Omit<
  ParsedSavingsGoalPlanApply,
  'missingMonthAdjustments' | 'planWithdrawalAdjustments'
> & {
  missingMonthAdjustments?: ParsedSavingsGoalPlanApply['missingMonthAdjustments'];
  planWithdrawalAdjustments?: ParsedSavingsGoalPlanApply['planWithdrawalAdjustments'];
};

/**
 * Prévision liée future d'un objectif (PUL-285 CA5) : candidate advisory à
 * figer ou retirer quand l'objectif passe PAUSED/COMPLETED. Servie par
 * `GET /savings-goals/:id/future-lines` — lignes liées, non pointées, non
 * ajustées à la main, du cycle courant (payDay-aware) et au-delà, y compris
 * après `target_date`. Montant déchiffré.
 */
export const savingsGoalFutureLineSchema = z.object({
  budgetLineId: z.uuid(),
  amount: z.coerce.number().nonnegative(),
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
});
export type SavingsGoalFutureLine = z.infer<typeof savingsGoalFutureLineSchema>;

export const savingsGoalFutureLinesQuerySchema = z.strictObject({
  targetDate: z.iso.date().optional(),
});
export type SavingsGoalFutureLinesQuery = z.infer<
  typeof savingsGoalFutureLinesQuerySchema
>;

/**
 * Décision advisory à l'arrêt de génération
 * (`POST /savings-goals/:id/generation-stop`, PUL-285 CA5/CA8) :
 * - `freeze` : garde la prévision, la délie de l'objectif ET la marque
 *   `is_manually_adjusted` (sinon une propagation RG-001 ultérieure la
 *   relierait) ;
 * - `remove` : supprime la prévision des mois futurs (ses transactions
 *   deviennent libres via FK `ON DELETE SET NULL`).
 * Refus atomique (CA9) : jamais de mois passé, de ligne pointée ou déjà
 * ajustée à la main.
 */
export const savingsGoalGenerationStopSchema = savingsGoalReconciliationSchema;
export type SavingsGoalGenerationStop = z.infer<
  typeof savingsGoalGenerationStopSchema
>;

/**
 * RETRAIT D'UN OBJECTIF (PUL-329) — un Revenu libre dont l'argent SORT du pot.
 *
 * Mouvement de STOCK : `confirmé = initialAmount + contributions confirmées −
 * retraits`. Il ne réécrit ni les prévisions futures, ni `confirmedPace`, ni le
 * statut de l'objectif. À ne pas confondre avec PUL-292
 * (`budgetLineSavingsWithdrawalCreateSchema`), qui programme un remboursement
 * en M+1 — ici l'argent est retiré définitivement.
 */
export const savingsGoalWithdrawalOptionSchema = z.object({
  goalId: z.uuid(),
  name: z.string().min(1),
  status: savingsGoalStatusSchema,
  /** Solde confirmé, strictement positif — le serveur filtre les objectifs vides. */
  availableAmount: z.coerce.number().positive(),
  /** Devise du compte : le contrôle de solde porte sur le montant converti (RG-009). */
  currency: supportedCurrencySchema,
});
export type SavingsGoalWithdrawalOption = z.infer<
  typeof savingsGoalWithdrawalOptionSchema
>;

export const savingsGoalWithdrawalOptionsResponseSchema = createListResponse(
  savingsGoalWithdrawalOptionSchema,
);
export type SavingsGoalWithdrawalOptionsResponse = z.infer<
  typeof savingsGoalWithdrawalOptionsResponseSchema
>;

/**
 * Une sortie d'argent, transportée POSITIVE : le signe négatif est une décision
 * de présentation, les clients l'ajoutent seuls.
 *
 * `nonnegative` plutôt que `positive` : ce schéma ne sert que des chemins de
 * lecture, où un montant indéchiffrable dégrade à zéro comme partout ailleurs.
 * Un seul ciphertext illisible ne doit pas emporter l'aperçu de suppression
 * entier, au moment précis où l'utilisateur a besoin de le voir complet.
 */
export const savingsGoalWithdrawalSchema = z.object({
  transactionId: z.uuid(),
  budgetId: z.uuid(),
  /** Prévision Revenu porteuse, absente pour un retrait libre. */
  budgetLineId: z.uuid().nullable().optional(),
  name: z.string().min(1),
  transactionDate: z.iso.datetime({ offset: true }),
  amount: z.coerce.number().nonnegative(),
  /** Le pointage qualifie le Réel ; il ne change jamais le stock retiré. */
  checkedAt: z.iso.datetime({ offset: true }).nullable().optional(),
});
export type SavingsGoalWithdrawal = z.infer<typeof savingsGoalWithdrawalSchema>;

export const savingsGoalPlannedWithdrawalSchema = z.object({
  budgetLineId: z.uuid(),
  budgetId: z.uuid(),
  name: z.string().min(1),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  plannedAmount: z.coerce.number().nonnegative(),
  realizedAmount: z.coerce.number().nonnegative(),
  remainingAmount: z.coerce.number().nonnegative(),
  status: z.enum(['planned', 'partially_realized', 'realized']),
  origin: z.literal('plan_linked').optional(),
});
export type SavingsGoalPlannedWithdrawal = z.infer<
  typeof savingsGoalPlannedWithdrawalSchema
>;

/** Retrait planifié directement dans l'objectif, sans budget ni pointage. */
export const savingsGoalPlanOnlyWithdrawalSchema = z.object({
  planWithdrawalId: z.uuid(),
  name: z.string().min(1),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  plannedAmount: z.coerce.number().nonnegative(),
  origin: z.literal('plan_only'),
});
export type SavingsGoalPlanOnlyWithdrawal = z.infer<
  typeof savingsGoalPlanOnlyWithdrawalSchema
>;

/**
 * `data` reste l'historique des Réels pour les clients déjà déployés. Le champ
 * additif `planned` porte le suivi Prévu/Réel/reliquat et se dégrade en liste
 * vide face à un serveur plus ancien.
 */
export const savingsGoalWithdrawalsResponseSchema = createListResponse(
  savingsGoalWithdrawalSchema,
).extend({
  planned: z.array(savingsGoalPlannedWithdrawalSchema).default([]),
  planOnly: z.array(savingsGoalPlanOnlyWithdrawalSchema).default([]),
});
export type SavingsGoalWithdrawalsResponse = z.infer<
  typeof savingsGoalWithdrawalsResponseSchema
>;

/**
 * Suppression d'un objectif (PUL-319).
 *
 * La révision reprend l'identité et la date de modification de chaque entité
 * affichée. Le client la renvoie telle quelle ; la RPC refuse la mutation si
 * l'impact courant diffère.
 */
export const savingsGoalDeletionRevisionEntrySchema = z.strictObject({
  id: z.uuid(),
  updatedAt: z.iso.datetime({ offset: true }),
});
export type SavingsGoalDeletionRevisionEntry = z.infer<
  typeof savingsGoalDeletionRevisionEntrySchema
>;

const uniqueDeletionRevisionEntries = z
  .array(savingsGoalDeletionRevisionEntrySchema)
  .refine(
    (entries) => new Set(entries.map(({ id }) => id)).size === entries.length,
    {
      error: 'Une entité apparaît deux fois dans la révision de suppression.',
    },
  );

export const savingsGoalDeletionRevisionSchema = z.strictObject({
  templateLines: uniqueDeletionRevisionEntries,
  budgetLines: uniqueDeletionRevisionEntries,
  transactions: uniqueDeletionRevisionEntries,
});
export type SavingsGoalDeletionRevision = z.infer<
  typeof savingsGoalDeletionRevisionSchema
>;

export const savingsGoalDeletionModeSchema = z.enum([
  'goal_only',
  'goal_and_forecasts',
  'goal_forecasts_and_transactions',
]);
export type SavingsGoalDeletionMode = z.infer<
  typeof savingsGoalDeletionModeSchema
>;

export const savingsGoalDeletionCommandSchema = z.strictObject({
  mode: savingsGoalDeletionModeSchema,
  revision: savingsGoalDeletionRevisionSchema,
});
export type SavingsGoalDeletionCommand = z.infer<
  typeof savingsGoalDeletionCommandSchema
>;

export const savingsGoalDeletionTemplateLineSchema = z.object({
  lineId: z.uuid(),
  templateId: z.uuid(),
  templateName: z.string().min(1),
  name: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  recurrence: transactionRecurrenceSchema,
  updatedAt: z.iso.datetime({ offset: true }),
});
export type SavingsGoalDeletionTemplateLine = z.infer<
  typeof savingsGoalDeletionTemplateLineSchema
>;

export const savingsGoalDeletionBudgetLineSchema = z.object({
  lineId: z.uuid(),
  name: z.string().min(1),
  amount: z.coerce.number().nonnegative(),
  recurrence: transactionRecurrenceSchema,
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
  updatedAt: z.iso.datetime({ offset: true }),
  transactions: z.array(z.lazy(() => transactionSchema)),
});
export type SavingsGoalDeletionBudgetLine = z.infer<
  typeof savingsGoalDeletionBudgetLineSchema
>;

export const savingsGoalDeletionBudgetSchema = z.object({
  budgetId: z.uuid(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR),
  lines: z.array(savingsGoalDeletionBudgetLineSchema),
});
export type SavingsGoalDeletionBudget = z.infer<
  typeof savingsGoalDeletionBudgetSchema
>;

export const savingsGoalDeletionImpactSchema = z.object({
  goalId: z.uuid(),
  summary: z.object({
    templateLineCount: z.number().int().nonnegative(),
    templateLineTotal: z.number().nonnegative(),
    budgetCount: z.number().int().nonnegative(),
    budgetLineCount: z.number().int().nonnegative(),
    budgetLineTotal: z.number().nonnegative(),
    transactionCount: z.number().int().nonnegative(),
    transactionTotal: z.number().nonnegative(),
    // `default` — additif : un payload antérieur à PUL-329 reste lisible.
    withdrawalCount: z.number().int().nonnegative().default(0),
    withdrawalTotal: z.number().nonnegative().default(0),
  }),
  templateLines: z.array(savingsGoalDeletionTemplateLineSchema),
  budgets: z.array(savingsGoalDeletionBudgetSchema),
  /**
   * Revenus provenant de cet objectif (PUL-329). TOUJOURS conservés, quel que
   * soit le mode : la transaction reste une réalité comptable du budget. Leur
   * lien devient cassé (identifiant null, dernier nom figé).
   */
  withdrawals: z.array(savingsGoalWithdrawalSchema).default([]),
  revision: savingsGoalDeletionRevisionSchema,
});
export type SavingsGoalDeletionImpact = z.infer<
  typeof savingsGoalDeletionImpactSchema
>;

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
  // Lien optionnel vers un objectif, autorisé uniquement pour kind=saving.
  savingsGoalId: z.uuid().nullable(),
  name: z.string().min(1).max(100).trim(),
  amount: z.coerce.number().nonnegative(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  // Tags (PUL-18) — même contrat que transaction.tagIds (ids only, noms via GET /tags)
  tagIds: z.array(z.uuid()).optional(),
  isManuallyAdjusted: z.boolean(),
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  // Rollover fields - added when budget line represents a rollover from previous month
  isRollover: z.boolean().optional(),
  rolloverSourceBudgetId: z.uuid().optional(),
  originalAmount: z.coerce.number().nonnegative().nullable().optional(),
  originalCurrency: supportedCurrencySchema.nullable().optional(),
  targetCurrency: supportedCurrencySchema.nullable().optional(),
  exchangeRate: exchangeRateWire.nullable().optional(),
  /**
   * Lissage (PUL-17): clé de groupe des N prévisions `one_off` sœurs réparties
   * sur plusieurs mois (interprétation B — chaque mois est une ligne indépendante).
   * uuid non-financier → JAMAIS chiffré. `null`/absent = ligne non lissée.
   * Read-only ici : l'assignation du groupe appartient à `POST /budget-lines/spread`,
   * pas à `budgetLineCreateSchema`. Champ additif, non-breaking.
   */
  spreadGroupId: z.uuid().nullable().optional(),
  /**
   * Pioche dans l'épargne (PUL-292): clé du COUPLE Revenu M ↔ Épargne M+1
   * (« Remettre sur ton épargne »). Lien léger — badge et suppression groupée
   * uniquement, JAMAIS de synchro de montants. uuid non-financier → JAMAIS
   * chiffré. Read-only ici : l'assignation appartient à
   * `POST /budget-lines/savings-withdrawal`. Champ additif, non-breaking.
   */
  savingsWithdrawalGroupId: z.uuid().nullable().optional(),
  /**
   * Retrait PLANIFIÉ depuis un objectif — l'origine d'un revenu prévu qui sera
   * puisé dans un objectif d'épargne. Mêmes noms et même sémantique à trois
   * états que sur `transaction` (PUL-329) : les deux nuls = revenu ordinaire ;
   * les deux présents = lien ACTIF ; identifiant nul + nom présent = lien CASSÉ
   * (objectif supprimé, provenance encore lisible).
   *
   * Distinct de `savingsGoalId`, qui signifie « contribution VERS l'objectif »
   * et n'est valide que pour `kind=saving` : l'un remplit le pot, l'autre le
   * vide. Réutiliser le même champ avec un signe rendrait les invariants
   * ambigus. `optional()` couvre le déploiement décalé des clients.
   */
  sourceSavingsGoalId: z.uuid().nullable().optional(),
  sourceSavingsGoalName: z.string().min(1).nullable().optional(),
});
export type BudgetLine = z.infer<typeof budgetLineSchema>;

const budgetLineCreateBaseSchema = z.strictObject({
  /**
   * Client-generated UUIDv4. Optional — server falls back to gen_random_uuid() if absent.
   * Enables idempotent retries and removes temp-id/real-id duality on the client.
   */
  id: z.uuid().optional(),
  budgetId: z.uuid(),
  templateLineId: z.uuid().nullable().optional(),
  savingsGoalId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  tagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .refine(hasUniqueTagIds, {
      message: 'Chaque tag ne peut être associé qu’une fois.',
    })
    .optional(),
  isManuallyAdjusted: z.boolean().default(false),
  checkedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: supportedCurrencySchema.optional(),
  targetCurrency: supportedCurrencySchema.optional(),
  exchangeRate: exchangeRateWirePositive.optional(),
  /**
   * Objectif dans lequel ce revenu prévu sera puisé. Le client n'envoie que
   * l'identifiant : le nom snapshot est lu et écrit par le serveur, qui seul
   * peut garantir qu'il correspond à un objectif du même utilisateur.
   */
  sourceSavingsGoalId: z.uuid().optional(),
});

/**
 * Un retrait planifié est un revenu ponctuel encore à venir. Chacune de ces
 * gardes ferme un état dans lequel le montant serait compté deux fois ou
 * n'aurait pas de sens comptable — le domaine les rejoue côté serveur, où les
 * appels directs à l'API arrivent aussi.
 *
 * Le lissage (PUL-17) et « remettre le mois prochain » (PUL-292) n'ont pas
 * besoin de garde ici : leurs clés de groupe appartiennent à leurs endpoints
 * dédiés et n'existent pas sur ce contrat de création.
 */
export const budgetLineCreateSchema = budgetLineCreateBaseSchema.superRefine(
  (value, ctx) => {
    if (value.sourceSavingsGoalId == null) return;

    const reject = (message: string): void => {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceSavingsGoalId'],
        message,
      });
    };

    if (value.kind !== 'income') {
      reject('Seul un revenu peut provenir d’un objectif d’épargne.');
    }

    if (value.recurrence !== 'one_off') {
      reject('Un retrait planifié est ponctuel, jamais récurrent.');
    }

    if (value.checkedAt != null) {
      reject(
        'Un retrait planifié commence non pointé : il se réalise en créant le revenu réel.',
      );
    }

    if (value.savingsGoalId != null) {
      reject(
        'Une prévision ne peut pas à la fois alimenter un objectif et y puiser.',
      );
    }
  },
);
export type BudgetLineCreate = z.infer<typeof budgetLineCreateSchema>;

/**
 * La source est immuable : la corriger, c'est supprimer puis recréer la
 * prévision avant sa réalisation. `sourceSavingsGoalName` n'a jamais été
 * accepté du client, il n'y a donc rien à en retirer ici.
 *
 * `checkedAt` non plus n'est pas acceptable ici. Pointer se demande à
 * `PATCH /budget-lines/:id/toggle-check`, seule route qui refuse de pointer un
 * retrait planifié — sortir l'argent d'un objectif se prouve en créant le
 * revenu réel, pas en cochant. Ce schéma dérive de la base *non raffinée* :
 * laisser passer `checkedAt` par ici contournerait ce refus en silence, et
 * `calculateRealizedIncome` compterait un revenu que rien n'a versé.
 */
export const budgetLineUpdateSchema = budgetLineCreateBaseSchema
  .omit({ budgetId: true, sourceSavingsGoalId: true, checkedAt: true })
  .partial()
  .extend({
    id: z.uuid(),
  });
export type BudgetLineUpdate = z.infer<typeof budgetLineUpdateSchema>;

const MAX_SPREAD_TRANCHES = 36;

const hasUniqueSpreadPeriods = (
  periods: readonly { year: number; month: number }[],
): boolean =>
  new Set(periods.map(({ year, month }) => `${year}-${month}`)).size ===
  periods.length;

/**
 * Un mois cible `{year, month}` — bornes MIN_YEAR/MAX_YEAR/MONTH partagées par
 * la création additive (`budgetLineSpreadCreateSchema.months`) et le lissage
 * d'une source existante (`*SpreadFrom*CreateSchema.periods`).
 */
export const spreadFromExistingPeriodSchema = z.object({
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
});
export type SpreadFromExistingPeriod = z.infer<
  typeof spreadFromExistingPeriodSchema
>;

/**
 * SPREAD — Création d'une dépense lissée sur plusieurs mois (PUL-17 / PUL-287).
 *
 * Le CLIENT envoie une INTENTION, pas des tranches. DEUX modes (`mode`) :
 *
 *   • `perMonth` — l'utilisateur saisit le montant porté par CHAQUE mois
 *     (`perMonthAmount`). Le SERVEUR RÉPLIQUE ce montant sur chaque mois cible
 *     (interprétation B : pure réplication, AUCUNE division — chaque mois reçoit
 *     exactement `perMonthAmount`, et `perMonthOriginalAmount` en full-FX).
 *
 *   • `total` — l'utilisateur saisit le montant TOTAL à lisser (`totalAmount`) et
 *     sélectionne N mois. Le SERVEUR DIVISE ce total sur les N mois en préservant la
 *     somme au centime (`splitTotalPreserving` : reste en centimes sur les PREMIERS
 *     mois) → Σ tranches = `totalAmount` exactement. En full-FX, `totalOriginalAmount`
 *     est divisé de la même façon (Σ originaux = `totalOriginalAmount`).
 *
 * `kind` exclut `income` (revenu lissé hors scope V1). Un SEUL `exchangeRate` figé à
 * la saisie (FX gelé, RG-009) — partagé par tous les mois dans les deux modes. Le
 * `spread_group_id` est assigné par le SERVEUR : il reprend `spreadGroupId` quand le
 * client fournit une clé d'idempotence, sinon il est généré côté serveur.
 *
 * NB : `perMonthAmount` (intention wire) est distinct du `perMonthAmount` du
 * view-model spread-occurrence (montant représentatif reçu d'un groupe existant).
 */
export const budgetLineSpreadCreateSchema = z
  .strictObject({
    name: z.string().min(1).max(100).trim(),
    kind: transactionKindSchema.exclude(['income']),
    savingsGoalId: z.uuid().nullable().optional(),
    mode: z.enum(['perMonth', 'total']),
    months: z
      .array(spreadFromExistingPeriodSchema)
      .min(1)
      .max(MAX_SPREAD_TRANCHES)
      .refine(hasUniqueSpreadPeriods, {
        message: 'Chaque mois cible ne peut apparaître qu’une fois.',
      }),
    // mode `perMonth` — montant répliqué tel quel sur chaque mois
    perMonthAmount: z.number().positive().optional(),
    perMonthOriginalAmount: z.number().positive().optional(),
    // mode `total` — montant divisé sur les mois côté serveur (Σ préservée)
    totalAmount: z.number().positive().optional(),
    totalOriginalAmount: z.number().positive().optional(),
    // FX figé (RG-009), partagé par les deux modes
    originalCurrency: supportedCurrencySchema.optional(),
    targetCurrency: supportedCurrencySchema.optional(),
    exchangeRate: exchangeRateWirePositive.optional(),
    /**
     * Clé d'idempotence OPTIONNELLE (PUL-17). Le client génère un uuid v4 stable
     * pour CETTE intention de lissage et le rejoue à l'identique sur un retry.
     * Le serveur l'utilise comme `spread_group_id` : un second POST avec la même
     * clé ne crée PAS un second groupe — il rejoue et renvoie les lignes déjà
     * créées avec le statut de la création d'origine (201 ; un replay idempotent
     * renvoie le résultat original, à la Stripe), après avoir re-tenté le recalcul
     * (idempotent → soigne un solde laissé
     * périmé par un premier recalcul échoué). Absente → le serveur génère la clé
     * comme avant (rétro-compatible : iOS/web non cassés tant qu'ils ne l'adoptent
     * pas). Champ additif, non-breaking.
     */
    spreadGroupId: z.uuid().optional(),
  })
  /**
   * Coherence — two cross-field invariants validated at the boundary so an
   * incoherent payload is rejected with a clean 400 instead of failing the
   * all-or-nothing fan-out INSERT (generic 500):
   *
   * (A) mode ⇄ amount: the mode's amount field is required, and mixing the other
   *     mode's amount fields is forbidden (no `totalAmount` in `perMonth`, etc.).
   *
   * (B) FX triad (mirrors the DB `fx_metadata_coherent` CHECK), applied to the
   *     mode-correct original-amount field (`perMonthOriginalAmount` or
   *     `totalOriginalAmount`). Exactly one of three FX states must hold:
   *       1. no FX        — no currencies, no rate, no original amount
   *       2. target-only  — targetCurrency set; originalCurrency/rate/original amount absent
   *       3. full FX      — originalCurrency+targetCurrency+exchangeRate set, origin≠target,
   *                         and the mode's original amount present
   *     The frozen rate is trusted as-is (RG-009) — never refetched here.
   */
  .superRefine((value, ctx) => {
    const isPerMonth = value.mode === 'perMonth';
    const baseAmount = isPerMonth ? value.perMonthAmount : value.totalAmount;
    const originalAmount = isPerMonth
      ? value.perMonthOriginalAmount
      : value.totalOriginalAmount;
    const wrongBaseAmount = isPerMonth
      ? value.totalAmount
      : value.perMonthAmount;
    const wrongOriginalAmount = isPerMonth
      ? value.totalOriginalAmount
      : value.perMonthOriginalAmount;

    // (A) mode ⇄ amount coherence
    if (baseAmount == null) {
      ctx.addIssue({
        code: 'custom',
        message: isPerMonth
          ? 'perMonthAmount est requis en mode perMonth.'
          : 'totalAmount est requis en mode total.',
      });
    }
    if (wrongBaseAmount != null || wrongOriginalAmount != null) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Champs de montant incompatibles avec le mode choisi (mélange perMonth/total interdit).',
      });
    }

    // (B) FX triad on the mode-correct original amount
    const hasOriginalCurrency = value.originalCurrency != null;
    const hasTargetCurrency = value.targetCurrency != null;
    const hasRate = value.exchangeRate != null;
    const hasOriginalAmount = originalAmount != null;

    const noFx =
      !hasOriginalCurrency &&
      !hasTargetCurrency &&
      !hasRate &&
      !hasOriginalAmount;
    const targetOnly =
      hasTargetCurrency &&
      !hasOriginalCurrency &&
      !hasRate &&
      !hasOriginalAmount;
    const fullFx =
      hasTargetCurrency &&
      hasOriginalCurrency &&
      hasRate &&
      hasOriginalAmount &&
      value.originalCurrency !== value.targetCurrency;

    if (!noFx && !targetOnly && !fullFx) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Métadonnées de change incohérentes : fournis soit aucune métadonnée FX, soit targetCurrency seule, soit le quadruplet complet (originalCurrency, targetCurrency, exchangeRate avec devises distinctes + le montant original du mode).',
      });
    }
  });
export type BudgetLineSpreadCreate = z.infer<
  typeof budgetLineSpreadCreateSchema
>;

/**
 * Réponse du fan-out : les lignes créées, les budgets auto-créés depuis le
 * template par défaut, et les mois ignorés (aucun template par défaut →
 * `skippedMonths`, calqué sur `budgetGenerateResponseSchema`).
 */
export const budgetLineSpreadResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    spreadGroupId: z.uuid(),
    lines: z.array(budgetLineSchema),
    createdBudgets: z.array(budgetSchema),
    skippedMonths: z.array(
      z.object({
        month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
        year: z.number().int().min(MIN_YEAR),
      }),
    ),
  }),
});
export type BudgetLineSpreadResponse = z.infer<
  typeof budgetLineSpreadResponseSchema
>;

/**
 * SPREAD-FROM-EXISTING (PUL-17 v1.1) — lissage TOTAL-PRÉSERVANT d'une source
 * DÉJÀ existante (prévision OU transaction). Le montant total `T` de la source
 * est REDISTRIBUÉ en N tranches `one_off` de `T/N` (Σ = T exactement, reste en
 * centimes sur les PREMIERS mois, mois courant M0 inclus). Contrairement à la
 * création additive (`budgetLineSpreadCreateSchema`, où le client envoie le
 * montant par mois + les mois et le serveur RÉPLIQUE), ici le client n'envoie QUE
 * les mois cibles : le serveur lit `T` (montant déchiffré de la source, autorité
 * unique → Σ=T ingarantissable côté client), calcule le SPLIT `T/N`, hérite le FX
 * figé de la source, fait le fan-out, puis SUPPRIME la source. La fenêtre démarre
 * à M0 vers le FUTUR (jamais le passé). N ≥ 2 (lisser sur 1 mois = no-op).
 */

/**
 * Lisser une PRÉVISION existante (`POST /budget-lines/:id/spread`).
 * Source = budget_line `one_off`, `kind ≠ income`, pas déjà lissée.
 */
export const budgetLineSpreadFromLineCreateSchema = z.strictObject({
  periods: z
    .array(spreadFromExistingPeriodSchema)
    .min(2)
    .max(MAX_SPREAD_TRANCHES)
    .refine(hasUniqueSpreadPeriods, {
      message: 'Chaque mois cible ne peut apparaître qu’une fois.',
    }),
});
export type BudgetLineSpreadFromLineCreate = z.infer<
  typeof budgetLineSpreadFromLineCreateSchema
>;

/**
 * Lisser une TRANSACTION LIBRE existante (`POST /transactions/:id/spread`).
 * Source = transaction `budgetLineId = null`, `kind ≠ income`. Le réel est
 * SUPPRIMÉ et remplacé par le plan d'amortissement (redistribution totale —
 * décision produit : M0 passe à T/N). Schéma distinct du from-line (règle
 * 1 endpoint = 1 schéma nommé) même si structurellement identique aujourd'hui.
 */
export const transactionSpreadFromTxnCreateSchema = z.strictObject({
  periods: z
    .array(spreadFromExistingPeriodSchema)
    .min(2)
    .max(MAX_SPREAD_TRANCHES)
    .refine(hasUniqueSpreadPeriods, {
      message: 'Chaque mois cible ne peut apparaître qu’une fois.',
    }),
});
export type TransactionSpreadFromTxnCreate = z.infer<
  typeof transactionSpreadFromTxnCreateSchema
>;

/**
 * SPREAD OCCURRENCES (PUL-17 Lot C) — one occurrence per `budget_line` of a
 * spread group, across all its months. Read-only cross-budget view.
 *
 * `month`/`year` are returned RAW — the client computes past/current/future
 * payDay-aware (`compareBudgetPeriods`), never the server (a frozen flag would
 * be stale + TZ-blind on a short cache). `checkedAt` drives the existing
 * "pointé" UI. Amounts decrypted server-side before serialization.
 */
export const spreadOccurrenceSchema = z.object({
  budgetLineId: z.uuid(),
  budgetId: z.uuid(),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  name: z.string(),
  amount: z.coerce.number().nonnegative(),
  kind: transactionKindSchema,
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
  /**
   * Réalisé (PUL-17): `consumed` = Σ des sous-transactions de cette occurrence
   * (déchiffrées côté serveur) ; `transactionCount` permet au client de choisir
   * consommé vs prévu. La détermination « mois clôturé » (vs aujourd'hui, payDay)
   * reste CLIENT — le serveur ne renvoie que ces faits. `default(0)` = additif.
   */
  consumed: z.coerce.number().nonnegative().default(0),
  transactionCount: z.coerce.number().int().nonnegative().default(0),
  originalAmount: z.coerce.number().nonnegative().nullable().optional(),
  originalCurrency: supportedCurrencySchema.nullable().optional(),
  targetCurrency: supportedCurrencySchema.nullable().optional(),
  exchangeRate: exchangeRateWire.nullable().optional(),
});
export type SpreadOccurrence = z.infer<typeof spreadOccurrenceSchema>;

export const spreadOccurrencesResponseSchema = createListResponse(
  spreadOccurrenceSchema,
);
export type SpreadOccurrencesResponse = z.infer<
  typeof spreadOccurrencesResponseSchema
>;

/**
 * PIOCHE DANS L'ÉPARGNE (PUL-292) — `POST /budget-lines/savings-withdrawal`.
 *
 * UNE action crée le COUPLE lié : un Revenu `one_off` de `amount` sur le mois du
 * `budgetId` consulté (M), et une Épargne `one_off` du MÊME `amount` sur M+1
 * (« Remettre sur ton épargne » — l'épargne reste une dépense planifiée, elle
 * réduit le disponible de M+1). Somme nulle sur 2 mois par construction : un
 * seul champ `amount` pour les deux lignes. Le serveur dérive M+1 du budget M
 * et le provisionne STRICTEMENT depuis le template par défaut (pas de template
 * → 422, rien n'est créé — une demi-paire corromprait les comptes).
 *
 * Les NOMS des deux lignes viennent du client (copy validée en test user,
 * backend sans i18n) : `incomeName` = la source saisie (« Mon épargne »,
 * « Impôts »…), `savingName` = le libellé du remboursement. Le badge « pris sur
 * ton épargne » et le sous-titre « mois d'origine » se DÉRIVENT du groupe et de
 * month±1 côté client — rien d'autre n'est stocké.
 *
 * `groupId` = clé d'idempotence OPTIONNELLE (pattern `spreadGroupId` PUL-17) :
 * uuid v4 stable par intention, rejoué à l'identique sur un retry. Le serveur
 * l'utilise comme `savings_withdrawal_group_id` ; un POST rejoué REPLAYE le
 * couple d'origine (201, à la Stripe) au lieu d'en créer un second.
 *
 * Un SEUL quad FX figé à la saisie (RG-009), partagé par les deux lignes — le
 * remboursement ne re-déclenche jamais de conversion.
 */
export const budgetLineSavingsWithdrawalCreateSchema = z
  .strictObject({
    budgetId: z.uuid(),
    amount: z.number().positive(),
    incomeName: z.string().min(1).max(100).trim(),
    savingName: z.string().min(1).max(100).trim(),
    groupId: z.uuid().optional(),
    originalAmount: z.number().positive().optional(),
    originalCurrency: supportedCurrencySchema.optional(),
    targetCurrency: supportedCurrencySchema.optional(),
    exchangeRate: exchangeRateWirePositive.optional(),
  })
  /**
   * Triade FX (miroir du CHECK DB `fx_metadata_coherent`, même contrat que
   * `budgetLineSpreadCreateSchema`) : exactement un des trois états —
   * 1. no FX ; 2. target-only ; 3. full FX (origin≠target + montant original).
   * Le taux figé est accepté tel quel (RG-009) — jamais re-fetché ici.
   */
  .superRefine((value, ctx) => {
    const hasOriginalCurrency = value.originalCurrency != null;
    const hasTargetCurrency = value.targetCurrency != null;
    const hasRate = value.exchangeRate != null;
    const hasOriginalAmount = value.originalAmount != null;

    const noFx =
      !hasOriginalCurrency &&
      !hasTargetCurrency &&
      !hasRate &&
      !hasOriginalAmount;
    const targetOnly =
      hasTargetCurrency &&
      !hasOriginalCurrency &&
      !hasRate &&
      !hasOriginalAmount;
    const fullFx =
      hasTargetCurrency &&
      hasOriginalCurrency &&
      hasRate &&
      hasOriginalAmount &&
      value.originalCurrency !== value.targetCurrency;

    if (!noFx && !targetOnly && !fullFx) {
      ctx.addIssue({
        code: 'custom',
        message:
          'Métadonnées de change incohérentes : fournis soit aucune métadonnée FX, soit targetCurrency seule, soit le quadruplet complet (originalCurrency, targetCurrency, exchangeRate avec devises distinctes + originalAmount).',
      });
    }
  });
export type BudgetLineSavingsWithdrawalCreate = z.infer<
  typeof budgetLineSavingsWithdrawalCreateSchema
>;

/**
 * Réponse du couple : les deux lignes créées (Revenu M, Épargne M+1) et le
 * budget M+1 auto-créé depuis le template par défaut (`null` s'il existait
 * déjà). Pair-shaped plutôt que `lines[]` : le client n'a jamais à deviner
 * quel élément est le revenu.
 */
export const budgetLineSavingsWithdrawalResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    groupId: z.uuid(),
    incomeLine: budgetLineSchema,
    savingLine: budgetLineSchema,
    createdBudget: budgetSchema.nullable(),
  }),
});
export type BudgetLineSavingsWithdrawalResponse = z.infer<
  typeof budgetLineSavingsWithdrawalResponseSchema
>;

/**
 * Suppression groupée (`DELETE /budget-lines/savings-withdrawal/:groupId`) —
 * le choix explicite de CA9, porté par `scope` :
 * - `pair` : « tout annuler » — les DEUX lignes sont supprimées ;
 * - `repayment` : « garder le Revenu de M seul » — seule l'Épargne de M+1 est
 *   supprimée ; le Revenu conserve son groupe (le badge « pris sur ton
 *   épargne » reste vrai).
 * Une suppression = un statement SQL (atomique). Réponse : delete générique.
 */
export const budgetLineSavingsWithdrawalDeleteQuerySchema = z.strictObject({
  scope: z.enum(['pair', 'repayment']),
});
export type BudgetLineSavingsWithdrawalDeleteQuery = z.infer<
  typeof budgetLineSavingsWithdrawalDeleteQuerySchema
>;

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
  amount: z.coerce.number().nonnegative(),
  kind: transactionKindSchema,
  transactionDate: z.iso.datetime({ offset: true }),
  // Tags remplacent l'ancien champ libre `category` (PUL-18). ids uniquement :
  // le client résout les noms via GET /tags (cache) — pas de join côté réponse.
  tagIds: z.array(z.uuid()).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
  originalAmount: z.coerce.number().nonnegative().nullable().optional(),
  originalCurrency: supportedCurrencySchema.nullable().optional(),
  targetCurrency: supportedCurrencySchema.nullable().optional(),
  exchangeRate: exchangeRateWire.nullable().optional(),
  /**
   * Origine d'épargne (PUL-329) — LECTURE SEULE, jamais éditable après coup.
   * Trois états : les deux nuls = revenu ordinaire ; les deux présents = lien
   * ACTIF navigable ; identifiant nul + nom présent = lien CASSÉ (l'objectif a
   * été supprimé, la provenance reste lisible). `optional()` couvre le
   * déploiement : un ancien backend omet encore les deux champs.
   */
  sourceSavingsGoalId: z.uuid().nullable().optional(),
  sourceSavingsGoalName: z.string().min(1).nullable().optional(),
});
export type Transaction = z.infer<typeof transactionSchema>;

export const transactionCreateSchema = z
  .strictObject({
    /**
     * Client-generated UUIDv4. Optional — server falls back to gen_random_uuid() if absent.
     * Enables idempotent retries and removes temp-id/real-id duality on the client.
     */
    id: z.uuid().optional(),
    budgetId: z.uuid(),
    budgetLineId: z.uuid().nullable().optional(),
    name: z.string().min(1).max(100).trim(),
    amount: z.number().positive(),
    kind: transactionKindSchema,
    transactionDate: z.iso.datetime({ offset: true }).optional(),
    tagIds: z
      .array(z.uuid())
      .max(MAX_TAGS_PER_TRANSACTION)
      .refine(hasUniqueTagIds, {
        message: 'Chaque tag ne peut être associé qu’une fois.',
      })
      .optional(),
    checkedAt: z.iso.datetime({ offset: true }).nullable().optional(),
    originalAmount: z.number().positive().optional(),
    originalCurrency: supportedCurrencySchema.optional(),
    targetCurrency: supportedCurrencySchema.optional(),
    exchangeRate: exchangeRateWirePositive.optional(),
    /**
     * Origine d'épargne (PUL-329) — acceptée UNIQUEMENT ici. Le lien est
     * immuable : ni le PATCH ni aucun autre contrat ne peut l'ajouter, le
     * remplacer ou l'effacer. Le nom snapshot appartient au serveur, jamais au
     * client. Un seul objectif par revenu, par cardinalité du champ.
     */
    sourceSavingsGoalId: z.uuid().optional(),
  })
  /**
   * Une source ENVOYÉE par le client ne peut viser qu'un Revenu LIBRE. Une
   * dépense ou une épargne « provenant » d'un objectif n'a pas de sens
   * comptable, et une source explicite posée sur une transaction allouée
   * ferait double emploi avec les contributions de l'objectif : la prévision
   * visée serait alors une prévision de CONTRIBUTION (`savingsGoalId`,
   * `kind=saving`), qui remplit le pot.
   *
   * Le retrait PLANIFIÉ ne contredit pas cette garde, il en sort par le haut :
   * sa prévision porte `sourceSavingsGoalId` et `kind=income`, elle VIDE le
   * pot. Réaliser un tel plan alloue donc bien une transaction à une prévision,
   * mais la source n'est jamais envoyée — le serveur la lit sur la prévision
   * référencée par `budgetLineId` et l'hérite lui-même. Le contrat client reste
   * donc strict tel quel : envoyer les deux ensemble resterait, aujourd'hui
   * comme avant, une double déclaration d'origine.
   */
  .superRefine((value, ctx) => {
    if (value.sourceSavingsGoalId == null) return;

    if (value.kind !== 'income') {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceSavingsGoalId'],
        message: 'Seul un revenu peut provenir d’un objectif d’épargne.',
      });
    }

    if (value.budgetLineId != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['sourceSavingsGoalId'],
        message:
          'Un revenu provenant d’un objectif d’épargne ne peut pas être alloué à une prévision.',
      });
    }
  });
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

export const transactionUpdateSchema = z.strictObject({
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  kind: transactionKindSchema.optional(),
  transactionDate: z.iso.datetime({ offset: true }).optional(),
  // présent = remplace l'ensemble des tags ; absent = ne touche pas
  tagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .refine(hasUniqueTagIds, {
      message: 'Chaque tag ne peut être associé qu’une fois.',
    })
    .optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: supportedCurrencySchema.optional(),
  targetCurrency: supportedCurrencySchema.optional(),
  exchangeRate: exchangeRateWirePositive.optional(),
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

export const TRANSACTION_SEARCH_QUERY_MIN_LENGTH = 2;
export const TRANSACTION_SEARCH_QUERY_MAX_LENGTH = 100;

/**
 * Global budget-item search filters.
 *
 * Text stays optional when at least one exact tag filter is provided. Multiple
 * years and tags are OR-ed within their group; the backend intersects the
 * active filter groups.
 */
export const transactionSearchQuerySchema = z
  .object({
    q: z
      .string()
      .min(TRANSACTION_SEARCH_QUERY_MIN_LENGTH)
      .max(TRANSACTION_SEARCH_QUERY_MAX_LENGTH)
      .optional(),
    years: z.array(z.number().int().min(MIN_YEAR).max(MAX_YEAR)).optional(),
    tagIds: z.array(z.uuid()).min(1).optional(),
  })
  .refine(({ q, tagIds }) => q !== undefined || (tagIds?.length ?? 0) > 0, {
    message: 'Un terme de recherche ou au moins un tag est requis.',
    path: ['q'],
  });
export type TransactionSearchQuery = z.infer<
  typeof transactionSearchQuerySchema
>;

export const transactionSearchResultSchema = z.object({
  id: z.uuid(),
  itemType: searchItemTypeSchema,
  name: z.string(),
  amount: z.coerce.number(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema.or(z.null()),
  transactionDate: z.iso.datetime({ offset: true }).or(z.null()),
  budgetId: z.uuid(),
  budgetName: z.string(),
  year: z.number().int().min(MIN_YEAR).max(MAX_YEAR),
  month: z.number().int().min(MONTH_MIN).max(MONTH_MAX),
  monthLabel: z.string(),
});
export type TransactionSearchResult = z.infer<
  typeof transactionSearchResultSchema
>;

export const transactionSearchResponseSchema = createListResponse(
  transactionSearchResultSchema,
);
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
  // Link to a savings goal (PUL-12). Lives on the model so a recurring saving
  // line stays tagged across monthly regenerations.
  savingsGoalId: z.uuid().nullable(),
  name: z.string().min(1).max(100).trim(),
  amount: z.coerce.number().nonnegative(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
  // Tags (PUL-18) — même contrat que budgetLine.tagIds (ids only, noms via GET /tags).
  // Copiés sur les budget_lines à la génération et lors de la propagation.
  tagIds: z.array(z.uuid()).optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  originalAmount: z.coerce.number().nonnegative().nullable().optional(),
  originalCurrency: supportedCurrencySchema.nullable().optional(),
  targetCurrency: supportedCurrencySchema.nullable().optional(),
  exchangeRate: exchangeRateWire.nullable().optional(),
});
export type TemplateLine = z.infer<typeof templateLineSchema>;

export const templateLineCreateSchema = z.strictObject({
  templateId: z.uuid(),
  savingsGoalId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
  tagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .refine(hasUniqueTagIds, {
      message: 'Chaque tag ne peut être associé qu’une fois.',
    })
    .optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: supportedCurrencySchema.optional(),
  targetCurrency: supportedCurrencySchema.optional(),
  exchangeRate: exchangeRateWirePositive.optional(),
});
export type TemplateLineCreate = z.infer<typeof templateLineCreateSchema>;

// Template line create without templateId (for batch creation)
export const templateLineCreateWithoutTemplateIdSchema = z.strictObject({
  savingsGoalId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim(),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: transactionRecurrenceSchema,
  description: z.string().max(500).trim(),
  tagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .refine(hasUniqueTagIds, {
      message: 'Chaque tag ne peut être associé qu’une fois.',
    })
    .optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: supportedCurrencySchema.optional(),
  targetCurrency: supportedCurrencySchema.optional(),
  exchangeRate: exchangeRateWirePositive.optional(),
});
export type TemplateLineCreateWithoutTemplateId = z.infer<
  typeof templateLineCreateWithoutTemplateIdSchema
>;

// Budget template schemas (after template line schemas)
export const budgetTemplateCreateSchema = z.strictObject({
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

export const budgetTemplateUpdateSchema = z.strictObject({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().optional(),
  isDefault: z.boolean().optional(),
});
export type BudgetTemplateUpdate = z.infer<typeof budgetTemplateUpdateSchema>;

// Template line update schema
export const templateLineUpdateSchema = z.strictObject({
  savingsGoalId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(100).trim().optional(),
  amount: z.number().positive().optional(),
  kind: transactionKindSchema.optional(),
  recurrence: transactionRecurrenceSchema.optional(),
  description: z.string().max(500).trim().optional(),
  // Present -> replace the line's exact tag set (and propagate). Absent -> tags untouched.
  tagIds: z
    .array(z.uuid())
    .max(MAX_TAGS_PER_TRANSACTION)
    .refine(hasUniqueTagIds, {
      message: 'Chaque tag ne peut être associé qu’une fois.',
    })
    .optional(),
  originalAmount: z.number().positive().optional(),
  originalCurrency: supportedCurrencySchema.optional(),
  targetCurrency: supportedCurrencySchema.optional(),
  exchangeRate: exchangeRateWirePositive.optional(),
});
export type TemplateLineUpdate = z.infer<typeof templateLineUpdateSchema>;

// Bulk template line update schemas
// Derived from templateLineUpdateSchema to avoid schema drift —
// new fields on the single-update schema flow through to bulk automatically.
export const templateLineUpdateWithIdSchema = templateLineUpdateSchema.extend({
  id: z.uuid(),
});
export type TemplateLineUpdateWithId = z.infer<
  typeof templateLineUpdateWithIdSchema
>;

// Extended bulk update schema supporting create, update, and delete operations
// Security: Limited to prevent DoS attacks and memory exhaustion
export const templateLinesBulkOperationsSchema = z
  .strictObject({
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
export const budgetResponseSchema = createSuccessResponse(budgetSchema);
export type BudgetResponse = z.infer<typeof budgetResponseSchema>;

export const budgetListResponseSchema = createListResponse(budgetSchema);
export type BudgetListResponse = z.infer<typeof budgetListResponseSchema>;

export const budgetExistsResponseSchema = z.object({
  hasBudget: z.boolean(),
});
export type BudgetExistsResponse = z.infer<typeof budgetExistsResponseSchema>;

export const budgetDeleteResponseSchema = deleteResponseSchema;
export type BudgetDeleteResponse = z.infer<typeof budgetDeleteResponseSchema>;

// Budget summary schema with rollover calculations
export const budgetSummarySchema = z.object({
  endingBalance: z.number(),
  rollover: z.number(),
});
export type BudgetSummary = z.infer<typeof budgetSummarySchema>;

/**
 * How the user's closed months (pay-day period ended, every prévision pointed)
 * usually drifted from their plan. Credibility prior for the home projection:
 * `usualOutflowDrift` = median of (actual − planned) / planned outflows, 0 when
 * the sign alternates; `priorStrength` = weight of the prior in days [3, 14];
 * `driftMad` = median absolute deviation of the end drifts, in currency;
 * `driftProfile` = share of the drift reached at 25/50/75/100 % of the period.
 */
export const driftHistorySchema = z.object({
  usualOutflowDrift: z.number(),
  closedMonths: z.number().int().positive(),
  priorStrength: z.number().int().min(3).max(14),
  driftMad: z.number().nonnegative(),
  driftProfile: z.array(z.number().min(0).max(1)).length(4),
});
export type DriftHistory = z.infer<typeof driftHistorySchema>;

// Budget details response schema - aggregates budget with its transactions and budget lines
export const budgetDetailsResponseSchema = createSuccessResponse(
  z.object({
    budget: budgetSchema,
    transactions: z.array(transactionSchema),
    budgetLines: z.array(budgetLineSchema),
    history: driftHistorySchema.nullable(),
  }),
);
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
export const budgetExportResponseSchema = createSuccessResponse(
  z.object({
    exportDate: z.string(),
    totalBudgets: z.number().int().nonnegative(),
    budgets: z.array(budgetWithDetailsSchema),
  }),
);
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
export const listBudgetsQuerySchema = z
  .object({
    fields: z
      .string()
      .optional()
      .refine(
        (val) => {
          if (val === undefined) return true;
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
    offset: z.coerce.number().int().nonnegative().optional(),
    year: z.coerce.number().int().min(MIN_YEAR).max(MAX_YEAR).optional(),
  })
  .refine((query) => query.offset === undefined || query.limit !== undefined, {
    message: 'offset requires limit',
    path: ['offset'],
  })
  .superRefine((query, context) => {
    if (query.fields !== undefined) return;

    for (const modifier of ['limit', 'offset', 'year'] as const) {
      if (modifier === 'offset' && query.limit === undefined) continue;
      if (query[modifier] !== undefined) {
        context.addIssue({
          code: 'custom',
          message: `${modifier} requires fields`,
          path: [modifier],
        });
      }
    }
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
export const budgetSparseListResponseSchema =
  createListResponse(budgetSparseSchema);
export type BudgetSparseListResponse = z.infer<
  typeof budgetSparseListResponseSchema
>;

// Transaction response schemas for operation-specific types
export const transactionResponseSchema =
  createSuccessResponse(transactionSchema);
export type TransactionCreateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionUpdateResponse = z.infer<
  typeof transactionResponseSchema
>;
export type TransactionFindOneResponse = z.infer<
  typeof transactionResponseSchema
>;

export const transactionListResponseSchema =
  createListResponse(transactionSchema);
export type TransactionListResponse = z.infer<
  typeof transactionListResponseSchema
>;

/**
 * Response for `POST /transactions/:id/postpone` (PUL-22). Carries the
 * postponed transaction plus both impacted budget ids so SWR clients can
 * invalidate the source and target months.
 */
export const transactionPostponeResponseSchema = createSuccessResponse(
  transactionSchema.extend({
    sourceBudgetId: z.uuid(),
    targetBudgetId: z.uuid(),
  }),
);
export type TransactionPostponeResponse = z.infer<
  typeof transactionPostponeResponseSchema
>;

export const transactionDeleteResponseSchema = deleteResponseSchema;
export type TransactionDeleteResponse = z.infer<
  typeof transactionDeleteResponseSchema
>;

// Budget template response schemas
export const budgetTemplateResponseSchema =
  createSuccessResponse(budgetTemplateSchema);
export type BudgetTemplateResponse = z.infer<
  typeof budgetTemplateResponseSchema
>;

export const budgetTemplateListResponseSchema =
  createListResponse(budgetTemplateSchema);
export type BudgetTemplateListResponse = z.infer<
  typeof budgetTemplateListResponseSchema
>;

export const budgetTemplateDeleteResponseSchema = deleteResponseSchema;
export type BudgetTemplateDeleteResponse = z.infer<
  typeof budgetTemplateDeleteResponseSchema
>;

// Response schema for template creation that includes created lines
export const budgetTemplateCreateResponseSchema = createSuccessResponse(
  z.object({
    template: budgetTemplateSchema,
    lines: z.array(templateLineSchema),
  }),
);
export type BudgetTemplateCreateResponse = z.infer<
  typeof budgetTemplateCreateResponseSchema
>;

// Response schema for template usage check
export const templateUsageResponseSchema = createSuccessResponse(
  z.object({
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
);
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
export const templateLineResponseSchema =
  createSuccessResponse(templateLineSchema);
export type TemplateLineResponse = z.infer<typeof templateLineResponseSchema>;

export const templateLineListResponseSchema =
  createListResponse(templateLineSchema);
export type TemplateLineListResponse = z.infer<
  typeof templateLineListResponseSchema
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
export const updateUserSettingsSchema = z
  .strictObject({
    payDayOfMonth: z
      .number()
      .int()
      .min(PAY_DAY_MIN)
      .max(PAY_DAY_MAX)
      .nullable()
      .optional(),
    currency: supportedCurrencySchema.optional(),
    showCurrencySelector: z.boolean().optional(),
    locale: supportedLocaleSchema.optional(),
  })
  .refine(
    ({ locale, payDayOfMonth, currency, showCurrencySelector }) =>
      locale === undefined ||
      (payDayOfMonth === undefined &&
        currency === undefined &&
        showCurrencySelector === undefined),
    { message: 'Locale must be updated separately from other settings' },
  );
export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

export const userSettingsSchema = z.object({
  payDayOfMonth: payDayOfMonthSchema,
  currency: supportedCurrencySchema.default('CHF'),
  showCurrencySelector: z.boolean().default(false),
  locale: supportedLocaleSchema.optional(),
});
export type UserSettings = z.infer<typeof userSettingsSchema>;

export const userSettingsResponseSchema =
  createSuccessResponse(userSettingsSchema);
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

export const deleteAccountResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  scheduledDeletionAt: z.iso.datetime({ offset: true }),
});
export type DeleteAccountResponse = z.infer<typeof deleteAccountResponseSchema>;

// Savings Goal response schemas
export const savingsGoalResponseSchema =
  createSuccessResponse(savingsGoalSchema);
export type SavingsGoalResponse = z.infer<typeof savingsGoalResponseSchema>;

export const savingsGoalListResponseSchema =
  createListResponse(savingsGoalSchema);
export type SavingsGoalListResponse = z.infer<
  typeof savingsGoalListResponseSchema
>;

export const savingsGoalDeleteResponseSchema = deleteResponseSchema;
export type SavingsGoalDeleteResponse = z.infer<
  typeof savingsGoalDeleteResponseSchema
>;

export const savingsGoalDeletionImpactResponseSchema = createSuccessResponse(
  savingsGoalDeletionImpactSchema,
);
export type SavingsGoalDeletionImpactResponse = z.infer<
  typeof savingsGoalDeletionImpactResponseSchema
>;

// Tag response schemas (PUL-18)
export const tagResponseSchema = createSuccessResponse(tagSchema);
export type TagResponse = z.infer<typeof tagResponseSchema>;

export const tagListResponseSchema = createListResponse(tagSchema);
export type TagListResponse = z.infer<typeof tagListResponseSchema>;

export const tagHistoryResponseSchema = createSuccessResponse(tagHistorySchema);
export type TagHistoryResponse = z.infer<typeof tagHistoryResponseSchema>;

export const tagDeleteResponseSchema = deleteResponseSchema;
export type TagDeleteResponse = z.infer<typeof tagDeleteResponseSchema>;

export const savingsGoalProgressResponseSchema = createSuccessResponse(
  savingsGoalProgressSchema,
);
export type SavingsGoalProgressResponse = z.infer<
  typeof savingsGoalProgressResponseSchema
>;

/**
 * Contribution d'un objectif (PUL-12) : une prévision Épargne liée, avec la
 * période de son budget parent et les transactions qui lui sont allouées.
 * Pointer la prévision (checkedAt) est une contribution SANS transaction —
 * la liste du suivi doit donc partir des lignes, pas des transactions.
 */
export const savingsGoalContributionSchema = z.object({
  lineId: z.uuid(),
  name: z.string(),
  amount: z.coerce.number().nonnegative(),
  checkedAt: z.iso.datetime({ offset: true }).nullable(),
  budgetMonth: z.number().int().min(1).max(12),
  budgetYear: z.number().int(),
  transactions: z.array(transactionSchema),
});
export type SavingsGoalContribution = z.infer<
  typeof savingsGoalContributionSchema
>;

export const savingsGoalContributionsResponseSchema = createListResponse(
  savingsGoalContributionSchema,
);
export type SavingsGoalContributionsResponse = z.infer<
  typeof savingsGoalContributionsResponseSchema
>;

/**
 * Réponse d'application d'un plan (`POST /savings-goals/:id/plan`) : les
 * prévisions mises à jour (déchiffrées).
 */
export const savingsGoalPlanApplyResponseSchema = createSuccessResponse(
  z.object({
    updatedLines: z.array(budgetLineSchema),
  }),
);
export type SavingsGoalPlanApplyResponse = z.infer<
  typeof savingsGoalPlanApplyResponseSchema
>;

export const savingsGoalFutureLinesResponseSchema = createListResponse(
  savingsGoalFutureLineSchema,
);
export type SavingsGoalFutureLinesResponse = z.infer<
  typeof savingsGoalFutureLinesResponseSchema
>;

export const savingsGoalGenerationStopResponseSchema = createSuccessResponse(
  z.object({
    affectedCount: z.number().int().nonnegative(),
  }),
);
export type SavingsGoalGenerationStopResponse = z.infer<
  typeof savingsGoalGenerationStopResponseSchema
>;

// Budget Line response schemas
export const budgetLineResponseSchema = createSuccessResponse(budgetLineSchema);
export type BudgetLineResponse = z.infer<typeof budgetLineResponseSchema>;

export const budgetLineListResponseSchema =
  createListResponse(budgetLineSchema);
export type BudgetLineListResponse = z.infer<
  typeof budgetLineListResponseSchema
>;

export const budgetLineDeleteResponseSchema = deleteResponseSchema;
export type BudgetLineDeleteResponse = z.infer<
  typeof budgetLineDeleteResponseSchema
>;

/**
 * Response for `POST /budget-lines/:id/postpone` (PUL-22). Carries the
 * postponed budget line plus both impacted budget ids so SWR clients can
 * invalidate the source and target months.
 */
export const budgetLinePostponeResponseSchema = createSuccessResponse(
  budgetLineSchema.extend({
    sourceBudgetId: z.uuid(),
    targetBudgetId: z.uuid(),
  }),
);
export type BudgetLinePostponeResponse = z.infer<
  typeof budgetLinePostponeResponseSchema
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
export const demoSessionCreateSchema = z.strictObject({
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

// Encryption schemas

// -- Request schemas --

/** Hex-encoded 32-byte key (64 hex chars) */
const hexKey64 = z.string().regex(/^[0-9a-f]{64}$/i);

/** POST /validate-key — hex-encoded 32-byte client key */
export const encryptionValidateKeyRequestSchema = z.object({
  clientKey: hexKey64,
});
export type EncryptionValidateKeyRequest = z.infer<
  typeof encryptionValidateKeyRequestSchema
>;

/** POST /recover — recovery key + new hex-encoded client key */
export const encryptionRecoverRequestSchema = z.strictObject({
  recoveryKey: z.string(),
  newClientKey: hexKey64,
});
export type EncryptionRecoverRequest = z.infer<
  typeof encryptionRecoverRequestSchema
>;

/** POST /verify-recovery-key — read-only unwrap check */
export const encryptionVerifyRecoveryKeyRequestSchema = z.object({
  recoveryKey: z.string().min(1).max(512),
});
export type EncryptionVerifyRecoveryKeyRequest = z.infer<
  typeof encryptionVerifyRecoveryKeyRequestSchema
>;

/** POST /change-pin — old + new hex-encoded client keys */
export const encryptionChangePinRequestSchema = z.strictObject({
  oldClientKey: hexKey64,
  newClientKey: hexKey64,
});
export type EncryptionChangePinRequest = z.infer<
  typeof encryptionChangePinRequestSchema
>;

// -- Response schemas --

export const encryptionVaultStatusResponseSchema = z.object({
  pinCodeConfigured: z.boolean(),
  recoveryKeyConfigured: z.boolean(),
  vaultCodeConfigured: z.boolean(),
});
export type EncryptionVaultStatusResponse = z.infer<
  typeof encryptionVaultStatusResponseSchema
>;

export const encryptionSaltResponseSchema = z.object({
  salt: z.string(),
  kdfIterations: z.number().int().positive(),
  hasRecoveryKey: z.boolean(),
});
export type EncryptionSaltResponse = z.infer<
  typeof encryptionSaltResponseSchema
>;

export const encryptionSetupRecoveryResponseSchema = z.object({
  recoveryKey: z.string(),
});
export type EncryptionSetupRecoveryResponse = z.infer<
  typeof encryptionSetupRecoveryResponseSchema
>;

export const encryptionRecoverResponseSchema = z.object({
  success: z.literal(true),
});
export type EncryptionRecoverResponse = z.infer<
  typeof encryptionRecoverResponseSchema
>;

export const encryptionChangePinResponseSchema = z.object({
  keyCheck: z.string(),
  recoveryKey: z.string(),
});
export type EncryptionChangePinResponse = z.infer<
  typeof encryptionChangePinResponseSchema
>;

/**
 * APP VERSION — Update policy
 *
 * Server-published minimum-supported-version per platform. Clients fetch on
 * launch + foreground, compare against their bundle version, and gate the UI
 * behind a non-dismissable "update required" screen when below `minVersion`.
 *
 * Endpoint: `GET /api/v1/app/version` (public, unauthenticated, cacheable).
 *
 * iOS uses `latestVersion` for a dismissible soft-update prompt; the web client
 * and Android still ignore it. `storeUrl` is the platform store deep link
 * (App Store for `ios`, Play Store for `android`).
 */
const semverString = z.string().regex(/^\d+\.\d+\.\d+$/);

const platformVersionSchema = z.object({
  minVersion: semverString,
  latestVersion: semverString,
  storeUrl: z.url().optional(),
});

export const appVersionResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    android: platformVersionSchema,
    ios: platformVersionSchema,
    web: platformVersionSchema,
  }),
});
export type AppVersionResponse = z.infer<typeof appVersionResponseSchema>;

/**
 * WHAT'S NEW — iOS release notes feed
 *
 * Authenticated feed of iOS-facing release notes newer than the client's
 * last-seen version, up to (and including) its current version. Powers the
 * in-app "what's new" surface. Releases that ship only technical changes never
 * surface — they carry no user-facing value.
 *
 * Endpoint: `GET /api/v1/whats-new/ios` (authenticated).
 */
export const whatsNewEntrySchema = z.object({
  version: semverString,
  title: z.string(),
  body: z.string(),
  publishedAt: z.iso.date(),
});
export type WhatsNewEntry = z.infer<typeof whatsNewEntrySchema>;

export const whatsNewResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    entries: z.array(whatsNewEntrySchema),
  }),
});
export type WhatsNewResponse = z.infer<typeof whatsNewResponseSchema>;

export const whatsNewQuerySchema = z.object({
  currentVersion: semverString,
  lastSeenVersion: semverString,
  locale: supportedLocaleSchema.optional(),
});
export type WhatsNewQuery = z.infer<typeof whatsNewQuerySchema>;

/**
 * FEEDBACK — Private in-app feedback
 *
 * Authenticated clients submit an overall rating and may add area ratings or
 * a short comment. Identity is always derived from the access token.
 */
export const feedbackRatingSchema = z.number().int().min(1).max(5);

const optionalFeedbackRatingSchema = feedbackRatingSchema.optional();
const maximumFeedbackCommentCodePointCount = 1_000;

// JavaScript string length counts UTF-16 units. Iteration counts Unicode code
// points instead, matching Swift `unicodeScalars` and PostgreSQL `char_length`.
const hasValidFeedbackCommentLength = (value: string): boolean =>
  Array.from(value).length <= maximumFeedbackCommentCodePointCount;

export const feedbackCreateSchema = z.strictObject({
  overallRating: feedbackRatingSchema,
  onboarding: optionalFeedbackRatingSchema,
  budgetClarity: optionalFeedbackRatingSchema,
  currentMonth: optionalFeedbackRatingSchema,
  futurePlanning: optionalFeedbackRatingSchema,
  homeClarity: optionalFeedbackRatingSchema,
  other: optionalFeedbackRatingSchema,
  comment: z
    .string()
    .trim()
    .refine(hasValidFeedbackCommentLength, {
      message: `Too big: expected string to have <=${maximumFeedbackCommentCodePointCount} Unicode code points`,
    })
    .optional()
    .transform((value) => value || undefined),
  appVersion: z.string().trim().min(1).max(32),
  iosVersion: z.string().trim().min(1).max(32),
});
export type FeedbackCreate = z.infer<typeof feedbackCreateSchema>;
