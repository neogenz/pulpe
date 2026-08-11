/**
 * Preuve que `pulpe-shared` (schemas Zod + calculators + Intl) tourne sous Hermes.
 *
 * Aucun calcul n'est réimplémenté ici : tout passe par le package partagé, pour
 * que la moindre divergence de build casse le test plutôt que l'écran.
 */
import {
  BudgetFormulas,
  formatBudgetPeriod,
  getBudgetPeriodForDate,
  getCurrencyFormatter,
  supportedCurrencySchema,
} from "pulpe-shared";

export interface SharedSmokeResult {
  currency: string;
  period: string;
  available: string;
  remaining: string;
}

/** Fixtures figées : les montants attendus sont vérifiés par `shared-smoke.spec.ts`. */
export const SMOKE_FIXTURE = {
  totalIncome: 6500,
  rollover: 240,
  totalExpenses: 4180.55,
  payDayOfMonth: 25,
} as const;

/** 28 janvier 2026, construit en heure locale pour rester indépendant du fuseau. */
export const SMOKE_DATE = new Date(2026, 0, 28);

export function runSharedSmoke(now: Date = SMOKE_DATE): SharedSmokeResult {
  const currency = supportedCurrencySchema.parse("CHF");
  const formatter = getCurrencyFormatter(currency);

  const { month, year } = getBudgetPeriodForDate(
    now,
    SMOKE_FIXTURE.payDayOfMonth,
  );
  const available = BudgetFormulas.calculateAvailable(
    SMOKE_FIXTURE.totalIncome,
    SMOKE_FIXTURE.rollover,
  );
  const remaining = BudgetFormulas.calculateRemaining(
    available,
    SMOKE_FIXTURE.totalExpenses,
  );

  return {
    currency,
    period: formatBudgetPeriod(month, year, SMOKE_FIXTURE.payDayOfMonth),
    available: formatter.format(available),
    remaining: formatter.format(remaining),
  };
}
